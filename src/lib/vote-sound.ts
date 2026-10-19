// Chime played on the booth after a vote is recorded, synthesized with the Web Audio API
// (no audio file to load). Sound is decoration only: every failure here is swallowed so it
// can never get in the way of casting a vote.

let context: AudioContext | null = null;

// Call synchronously inside the click handler: browsers only allow audio that a user
// gesture unlocked, and the chime itself plays later, after the network round trip.
export function primeVoteSound() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    context = null;
  }
}

// Rising C major arpeggio with a soft bell tail, about 2.5 seconds in total.
const NOTES = [
  { freq: 523.25, at: 0 }, // C5
  { freq: 659.25, at: 0.16 }, // E5
  { freq: 783.99, at: 0.32 }, // G5
  { freq: 1046.5, at: 0.5 }, // C6
  { freq: 1318.51, at: 0.5 }, // E6, rings with the last note as a chord
];

export function playVoteSound() {
  try {
    if (!context) return;
    const ctx = context;
    const start = ctx.currentTime + 0.02;

    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);

    for (const [i, note] of NOTES.entries()) {
      const last = i >= NOTES.length - 2;
      const t = start + note.at;
      const decay = last ? 2 : 0.9;

      // Fundamental plus a quiet octave overtone gives a bell-like tone.
      for (const [mult, level] of [
        [1, 0.32],
        [2, 0.07],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = note.freq * mult;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(level * (last ? 0.8 : 1), t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

        osc.connect(gain).connect(master);
        osc.start(t);
        osc.stop(t + decay + 0.05);
      }
    }
  } catch {
    // Ignore: no sound is better than a broken booth.
  }
}
