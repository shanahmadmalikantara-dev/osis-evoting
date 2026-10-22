// Offline backup booth. All logic lives in the `voting-store` crate; this file only wires it
// to the window. No network access from Rust: the candidate list is fetched by the page once
// (H-1, while online) and stored here.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, State};
use voting_store::{Candidate, PublicState, Report, Status, Store};

#[tauri::command]
fn get_state(store: State<Store>) -> Result<PublicState, String> {
    store.state()
}

#[tauri::command]
fn setup(store: State<Store>, bilik: u32, pin: String, site_url: String, candidates: Vec<Candidate>, synced_at: String) -> Result<(), String> {
    store.setup(bilik, &pin, &site_url, candidates, &synced_at)
}

#[tauri::command]
fn verify_pin(store: State<Store>, pin: String) -> Result<(), String> {
    store.verify_pin(&pin)
}

#[tauri::command]
fn update_candidates(store: State<Store>, pin: String, site_url: String, candidates: Vec<Candidate>, synced_at: String) -> Result<(), String> {
    store.update_candidates(&pin, &site_url, candidates, &synced_at)
}

#[tauri::command]
fn set_status(store: State<Store>, pin: String, status: Status) -> Result<(), String> {
    store.set_status(&pin, status)
}

#[tauri::command]
fn cast_vote(store: State<Store>, id: String, candidate_id: String) -> Result<(), String> {
    store.cast_vote(&id, &candidate_id)
}

#[tauri::command]
fn report(store: State<Store>, pin: String) -> Result<Report, String> {
    store.report(&pin)
}

#[tauri::command]
fn export_files(app: tauri::AppHandle, store: State<Store>, pin: String) -> Result<String, String> {
    let documents = app.path().document_dir().map_err(|e| e.to_string())?;
    let folder = store.export(&pin, &documents.join("Pemilu OSIS Cadangan"))?;
    Ok(folder.display().to_string())
}

#[tauri::command]
fn reset_votes(store: State<Store>, pin: String, confirm: String) -> Result<u64, String> {
    store.reset_votes(&pin, &confirm)
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle, store: State<Store>, pin: String) -> Result<(), String> {
    store.verify_pin(&pin)?;
    app.exit(0);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            app.manage(Store::new(dir)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            setup,
            verify_pin,
            update_candidates,
            set_status,
            cast_vote,
            report,
            export_files,
            reset_votes,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("failed to start the backup booth");
}
