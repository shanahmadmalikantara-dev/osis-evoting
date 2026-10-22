//! Local storage for the offline backup booth.
//!
//! Everything lives in one folder on the laptop:
//! - `config.json`: booth number, website address, candidate list (with photos), status, PIN hash.
//! - `votes.jsonl`: one line per vote, appended and flushed to disk before the voter sees
//!   "Terima kasih". No voter identity and no timestamps are stored.
//!
//! Officer actions (open/close, results, export, reset) need the PIN. Five wrong PINs lock the
//! officer panel for a minute so a voter cannot guess it at the booth.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

pub const RESET_PHRASE: &str = "HAPUS";
const MAX_PIN_FAILURES: u32 = 5;
const PIN_LOCK: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Candidate {
    pub id: String,
    pub nomor_urut: u32,
    pub nama_ketua: String,
    pub nama_wakil: String,
    pub foto_url: Option<String>,
    #[serde(default)]
    pub visi_misi: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Ready,
    Open,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Config {
    bilik: u32,
    site_url: String,
    candidates: Vec<Candidate>,
    synced_at: String,
    status: Status,
    pin_salt: String,
    pin_hash: String,
}

/// What the booth screen may know: no PIN hash and no vote counts.
#[derive(Debug, Clone, Serialize)]
pub struct PublicState {
    pub configured: bool,
    pub bilik: Option<u32>,
    pub site_url: Option<String>,
    pub candidates: Vec<Candidate>,
    pub synced_at: Option<String>,
    pub status: Status,
}

#[derive(Debug, Clone, Serialize)]
pub struct TallyRow {
    pub nomor_urut: u32,
    pub nama_ketua: String,
    pub nama_wakil: String,
    pub votes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Report {
    pub bilik: u32,
    pub status: Status,
    pub total: u64,
    pub rows: Vec<TallyRow>,
    /// Votes whose candidate is no longer in the list (should stay 0).
    pub unknown: u64,
    /// SHA-256 of votes.jsonl, printed on the report so witnesses can check the file later.
    pub file_hash: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct VoteLine {
    id: String,
    c: String,
    n: u32,
}

pub struct Store {
    dir: PathBuf,
    // Serializes all disk access; a booth only ever has one window.
    lock: Mutex<PinGuard>,
}

#[derive(Default)]
struct PinGuard {
    failures: u32,
    locked_until: Option<Instant>,
}

pub type Result<T> = std::result::Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn hash_pin(salt: &str, pin: &str) -> String {
    let mut h = Sha256::new();
    h.update(salt.as_bytes());
    h.update(b":");
    h.update(pin.as_bytes());
    hex(&h.finalize())
}

fn valid_pin(pin: &str) -> bool {
    (4..=8).contains(&pin.len()) && pin.chars().all(|c| c.is_ascii_digit())
}

fn now_stamp() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Writes a file atomically: a crash mid-write leaves the old file intact.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let tmp = path.with_extension("tmp");
    {
        let mut f = File::create(&tmp).map_err(err)?;
        f.write_all(bytes).map_err(err)?;
        f.sync_all().map_err(err)?;
    }
    fs::rename(&tmp, path).map_err(err)
}

impl Store {
    pub fn new(dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&dir).map_err(err)?;
        Ok(Self { dir, lock: Mutex::new(PinGuard::default()) })
    }

    fn config_path(&self) -> PathBuf {
        self.dir.join("config.json")
    }

    pub fn votes_path(&self) -> PathBuf {
        self.dir.join("votes.jsonl")
    }

    fn read_config(&self) -> Result<Option<Config>> {
        match fs::read(self.config_path()) {
            Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(err),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(err(e)),
        }
    }

    fn write_config(&self, config: &Config) -> Result<()> {
        write_atomic(&self.config_path(), &serde_json::to_vec_pretty(config).map_err(err)?)
    }

    fn require_config(&self) -> Result<Config> {
        self.read_config()?.ok_or_else(|| "not_configured".to_string())
    }

    /// Checks the PIN with a lockout after repeated failures.
    fn check_pin(&self, guard: &mut PinGuard, config: &Config, pin: &str) -> Result<()> {
        if let Some(until) = guard.locked_until {
            let now = Instant::now();
            if now < until {
                return Err(format!("pin_locked:{}", (until - now).as_secs() + 1));
            }
            guard.locked_until = None;
            guard.failures = 0;
        }
        if hash_pin(&config.pin_salt, pin) == config.pin_hash {
            guard.failures = 0;
            return Ok(());
        }
        guard.failures += 1;
        if guard.failures >= MAX_PIN_FAILURES {
            guard.locked_until = Some(Instant::now() + PIN_LOCK);
            return Err(format!("pin_locked:{}", PIN_LOCK.as_secs()));
        }
        Err("pin_wrong".into())
    }

    fn read_votes(&self) -> Result<Vec<VoteLine>> {
        let file = match File::open(self.votes_path()) {
            Ok(f) => f,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
            Err(e) => return Err(err(e)),
        };
        let mut seen = HashSet::new();
        let mut votes = vec![];
        for line in BufReader::new(file).lines() {
            let line = line.map_err(err)?;
            if line.trim().is_empty() {
                continue;
            }
            // A line cut off by a power failure is skipped; every complete line is a vote.
            let Ok(vote) = serde_json::from_str::<VoteLine>(&line) else { continue };
            if seen.insert(vote.id.clone()) {
                votes.push(vote);
            }
        }
        Ok(votes)
    }

    fn file_hash(&self) -> Result<String> {
        match fs::read(self.votes_path()) {
            Ok(bytes) => Ok(hex(&Sha256::digest(&bytes))),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(hex(&Sha256::digest(b""))),
            Err(e) => Err(err(e)),
        }
    }

    pub fn state(&self) -> Result<PublicState> {
        let _g = self.lock.lock().map_err(err)?;
        Ok(match self.read_config()? {
            Some(c) => PublicState {
                configured: true,
                bilik: Some(c.bilik),
                site_url: Some(c.site_url),
                candidates: c.candidates,
                synced_at: Some(c.synced_at),
                status: c.status,
            },
            None => PublicState {
                configured: false,
                bilik: None,
                site_url: None,
                candidates: vec![],
                synced_at: None,
                status: Status::Ready,
            },
        })
    }

    pub fn setup(&self, bilik: u32, pin: &str, site_url: &str, candidates: Vec<Candidate>, synced_at: &str) -> Result<()> {
        let _g = self.lock.lock().map_err(err)?;
        if self.read_config()?.is_some() {
            return Err("already_configured".into());
        }
        if !(1..=99).contains(&bilik) {
            return Err("invalid_bilik".into());
        }
        if !valid_pin(pin) {
            return Err("invalid_pin".into());
        }
        if candidates.is_empty() {
            return Err("no_candidates".into());
        }
        let mut salt = [0u8; 16];
        getrandom::getrandom(&mut salt).map_err(err)?;
        let salt = hex(&salt);
        self.write_config(&Config {
            bilik,
            site_url: site_url.to_string(),
            candidates,
            synced_at: synced_at.to_string(),
            status: Status::Ready,
            pin_hash: hash_pin(&salt, pin),
            pin_salt: salt,
        })
    }

    pub fn verify_pin(&self, pin: &str) -> Result<()> {
        let mut g = self.lock.lock().map_err(err)?;
        let config = self.require_config()?;
        self.check_pin(&mut g, &config, pin)
    }

    /// Replaces the candidate list. Only allowed before any vote is stored, so a vote can never
    /// end up pointing at a different candidate.
    pub fn update_candidates(&self, pin: &str, site_url: &str, candidates: Vec<Candidate>, synced_at: &str) -> Result<()> {
        let mut g = self.lock.lock().map_err(err)?;
        let mut config = self.require_config()?;
        self.check_pin(&mut g, &config, pin)?;
        if !self.read_votes()?.is_empty() {
            return Err("votes_not_empty".into());
        }
        if candidates.is_empty() {
            return Err("no_candidates".into());
        }
        config.candidates = candidates;
        config.site_url = site_url.to_string();
        config.synced_at = synced_at.to_string();
        self.write_config(&config)
    }

    pub fn set_status(&self, pin: &str, status: Status) -> Result<()> {
        let mut g = self.lock.lock().map_err(err)?;
        let mut config = self.require_config()?;
        self.check_pin(&mut g, &config, pin)?;
        config.status = status;
        self.write_config(&config)
    }

    /// Appends one vote and forces it to disk. Retrying with the same id never counts twice.
    pub fn cast_vote(&self, id: &str, candidate_id: &str) -> Result<()> {
        let _g = self.lock.lock().map_err(err)?;
        let config = self.require_config()?;
        if config.status != Status::Open {
            return Err("election_not_open".into());
        }
        let Some(candidate) = config.candidates.iter().find(|c| c.id == candidate_id) else {
            return Err("invalid_candidate".into());
        };
        if id.is_empty() || id.len() > 64 {
            return Err("invalid_submission".into());
        }
        if self.read_votes()?.iter().any(|v| v.id == id) {
            return Ok(());
        }
        let line = serde_json::to_string(&VoteLine { id: id.into(), c: candidate.id.clone(), n: candidate.nomor_urut })
            .map_err(err)?;
        let mut f = OpenOptions::new().create(true).append(true).open(self.votes_path()).map_err(err)?;
        f.write_all(format!("{line}\n").as_bytes()).map_err(err)?;
        f.sync_all().map_err(err)
    }

    pub fn report(&self, pin: &str) -> Result<Report> {
        let mut g = self.lock.lock().map_err(err)?;
        let config = self.require_config()?;
        self.check_pin(&mut g, &config, pin)?;
        self.build_report(&config)
    }

    fn build_report(&self, config: &Config) -> Result<Report> {
        let votes = self.read_votes()?;
        let mut counts: BTreeMap<&str, u64> = BTreeMap::new();
        for v in &votes {
            *counts.entry(v.c.as_str()).or_default() += 1;
        }
        let mut rows: Vec<TallyRow> = config
            .candidates
            .iter()
            .map(|c| TallyRow {
                nomor_urut: c.nomor_urut,
                nama_ketua: c.nama_ketua.clone(),
                nama_wakil: c.nama_wakil.clone(),
                votes: counts.get(c.id.as_str()).copied().unwrap_or(0),
            })
            .collect();
        rows.sort_by_key(|r| r.nomor_urut);
        let known: u64 = rows.iter().map(|r| r.votes).sum();
        Ok(Report {
            bilik: config.bilik,
            status: config.status,
            total: votes.len() as u64,
            unknown: votes.len() as u64 - known,
            rows,
            file_hash: self.file_hash()?,
        })
    }

    /// Writes the tally (CSV) and a copy of the raw vote file into `target`. Returns the folder.
    pub fn export(&self, pin: &str, target: &Path) -> Result<PathBuf> {
        let mut g = self.lock.lock().map_err(err)?;
        let config = self.require_config()?;
        self.check_pin(&mut g, &config, pin)?;
        let report = self.build_report(&config)?;
        let folder = target.join(format!("bilik-cadangan-{}-{}", config.bilik, now_stamp()));
        fs::create_dir_all(&folder).map_err(err)?;

        let mut csv = String::from("nomor_urut,nama_ketua,nama_wakil,suara\r\n");
        for r in &report.rows {
            csv.push_str(&format!("{},{},{},{}\r\n", r.nomor_urut, csv_cell(&r.nama_ketua), csv_cell(&r.nama_wakil), r.votes));
        }
        csv.push_str(&format!(",,TOTAL,{}\r\n", report.total));
        csv.push_str(&format!(",,BILIK CADANGAN,{}\r\n", report.bilik));
        csv.push_str(&format!(",,SHA-256 votes.jsonl,{}\r\n", report.file_hash));
        // Byte order mark so Excel opens the file as UTF-8.
        write_atomic(&folder.join("rekap.csv"), format!("\u{feff}{csv}").as_bytes())?;
        if self.votes_path().exists() {
            fs::copy(self.votes_path(), folder.join("votes.jsonl")).map_err(err)?;
        }
        Ok(folder)
    }

    /// Moves the vote file into an archive (nothing is destroyed) and starts empty.
    /// Returns how many votes were archived.
    pub fn reset_votes(&self, pin: &str, confirm: &str) -> Result<u64> {
        let mut g = self.lock.lock().map_err(err)?;
        let mut config = self.require_config()?;
        self.check_pin(&mut g, &config, pin)?;
        if confirm.trim() != RESET_PHRASE {
            return Err("reset_confirm_mismatch".into());
        }
        let count = self.read_votes()?.len() as u64;
        if self.votes_path().exists() {
            let archive = self.dir.join("arsip");
            fs::create_dir_all(&archive).map_err(err)?;
            fs::rename(self.votes_path(), archive.join(format!("votes-{}.jsonl", now_stamp()))).map_err(err)?;
        }
        config.status = Status::Ready;
        self.write_config(&config)?;
        Ok(count)
    }
}

fn csv_cell(value: &str) -> String {
    // Quote always; neutralize spreadsheet formulas.
    let safe = if value.starts_with(['=', '+', '-', '@']) { format!("'{value}") } else { value.to_string() };
    format!("\"{}\"", safe.replace('"', "\"\""))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("voting-store-{name}-{}", now_stamp() as u128 * 1000 + std::process::id() as u128));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn candidates() -> Vec<Candidate> {
        (1..=3)
            .map(|n| Candidate {
                id: format!("cand-{n}"),
                nomor_urut: n,
                nama_ketua: format!("Ketua {n}"),
                nama_wakil: format!("Wakil {n}"),
                foto_url: None,
                visi_misi: String::new(),
            })
            .collect()
    }

    fn ready_store(name: &str) -> Store {
        let s = Store::new(temp_dir(name)).unwrap();
        s.setup(3, "123456", "https://example.test", candidates(), "now").unwrap();
        s
    }

    #[test]
    fn votes_only_while_open() {
        let s = ready_store("open");
        assert_eq!(s.cast_vote("a", "cand-1").unwrap_err(), "election_not_open");
        s.set_status("123456", Status::Open).unwrap();
        s.cast_vote("a", "cand-1").unwrap();
        s.set_status("123456", Status::Closed).unwrap();
        assert_eq!(s.cast_vote("b", "cand-1").unwrap_err(), "election_not_open");
        assert_eq!(s.report("123456").unwrap().total, 1);
    }

    #[test]
    fn same_id_counts_once_and_tally_matches() {
        let s = ready_store("tally");
        s.set_status("123456", Status::Open).unwrap();
        for (i, c) in ["cand-1", "cand-2", "cand-1", "cand-3", "cand-1"].iter().enumerate() {
            s.cast_vote(&format!("v{i}"), c).unwrap();
        }
        s.cast_vote("v0", "cand-1").unwrap(); // retry of the first vote
        assert_eq!(s.cast_vote("x", "cand-9").unwrap_err(), "invalid_candidate");
        let r = s.report("123456").unwrap();
        assert_eq!(r.total, 5);
        assert_eq!(r.rows.iter().map(|r| r.votes).collect::<Vec<_>>(), vec![3, 1, 1]);
        assert_eq!(r.unknown, 0);
    }

    #[test]
    fn survives_restart_and_skips_a_torn_last_line() {
        let dir = temp_dir("restart");
        {
            let s = Store::new(dir.clone()).unwrap();
            s.setup(1, "1234", "u", candidates(), "now").unwrap();
            s.set_status("1234", Status::Open).unwrap();
            s.cast_vote("a", "cand-2").unwrap();
        }
        // Simulate a power cut halfway through writing a line.
        let mut f = OpenOptions::new().append(true).open(dir.join("votes.jsonl")).unwrap();
        f.write_all(b"{\"id\":\"b\",\"c\":\"ca").unwrap();
        let s = Store::new(dir).unwrap();
        let r = s.report("1234").unwrap();
        assert_eq!(r.total, 1);
        assert_eq!(r.rows[1].votes, 1);
    }

    #[test]
    fn pin_is_required_and_locks_after_five_failures() {
        let s = ready_store("pin");
        assert_eq!(s.report("000000").unwrap_err(), "pin_wrong");
        for _ in 0..3 {
            let _ = s.verify_pin("000000");
        }
        assert!(s.verify_pin("000000").unwrap_err().starts_with("pin_locked:"));
        // Even the right PIN is refused while locked.
        assert!(s.verify_pin("123456").unwrap_err().starts_with("pin_locked:"));
    }

    #[test]
    fn candidates_frozen_once_votes_exist() {
        let s = ready_store("frozen");
        s.update_candidates("123456", "u", candidates(), "later").unwrap();
        s.set_status("123456", Status::Open).unwrap();
        s.cast_vote("a", "cand-1").unwrap();
        assert_eq!(s.update_candidates("123456", "u", candidates(), "later").unwrap_err(), "votes_not_empty");
    }

    #[test]
    fn reset_archives_instead_of_deleting() {
        let s = ready_store("reset");
        s.set_status("123456", Status::Open).unwrap();
        s.cast_vote("a", "cand-1").unwrap();
        assert_eq!(s.reset_votes("123456", "hapus").unwrap_err(), "reset_confirm_mismatch");
        assert_eq!(s.reset_votes("123456", "HAPUS").unwrap(), 1);
        assert_eq!(s.report("123456").unwrap().total, 0);
        assert_eq!(s.state().unwrap().status, Status::Ready);
        assert_eq!(fs::read_dir(s.dir.join("arsip")).unwrap().count(), 1);
    }

    #[test]
    fn export_writes_csv_and_raw_file() {
        let s = ready_store("export");
        s.set_status("123456", Status::Open).unwrap();
        s.cast_vote("a", "cand-2").unwrap();
        let out = temp_dir("export-out");
        let folder = s.export("123456", &out).unwrap();
        let csv = fs::read_to_string(folder.join("rekap.csv")).unwrap();
        assert!(csv.contains("2,\"Ketua 2\",\"Wakil 2\",1"));
        assert!(csv.contains(",,TOTAL,1"));
        assert!(folder.join("votes.jsonl").exists());
    }

    #[test]
    fn booth_state_hides_pin_and_counts() {
        let s = ready_store("public");
        let json = serde_json::to_string(&s.state().unwrap()).unwrap();
        assert!(!json.contains("pin"));
        assert!(!json.contains("votes"));
    }
}
