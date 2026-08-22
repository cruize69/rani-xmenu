// src/lib/kitchenChime.js — shared new-order alert sound for every staff
// screen (OrderManager.jsx, TvKitchenDisplay.jsx). Extracted from
// TvKitchenDisplay.jsx, which already had this exact "Elephant & Thali"
// design — three consecutive elephant-trumpet-roar + brass-thali-clash
// bursts, ~5.5 seconds total — built for its own use. OrderManager.jsx
// previously had its own much weaker chime (a single ~0.5s three-note
// arpeggio) that was easy to miss entirely if staff weren't looking at
// that exact half-second; this replaces it with the same long, distinct,
// on-brand alert instead of inventing a second sound identity.
//
// Browsers suspend a freshly-created AudioContext until a user gesture
// unlocks it, so a chime fired from a poll (no gesture in the call stack)
// would otherwise stay silent — call unlockAudioContext() from a page-
// level click/keydown listener once on mount (both callers already do).
let globalAudioCtx = null;

export function getAudioContext() {
  if (!globalAudioCtx && typeof window !== "undefined") {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx && globalAudioCtx.state === "suspended") {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

export function unlockAudioContext() {
  getAudioContext();
}

function playSingleRoarAndClash(ctx, startTime, isGrandFinale = false) {
  // ── 1. Royal Elephant Trumpet Roar ─────────────────────────────
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  mod.type = "sawtooth";
  mod.frequency.setValueAtTime(34, startTime);
  modGain.gain.setValueAtTime(90, startTime);

  const carrier = ctx.createOscillator();
  const carrierGain = ctx.createGain();
  carrier.type = "sawtooth";
  carrier.frequency.setValueAtTime(180, startTime);
  carrier.frequency.exponentialRampToValueAtTime(isGrandFinale ? 520 : 460, startTime + 0.20);
  carrier.frequency.linearRampToValueAtTime(300, startTime + 0.50);

  carrierGain.gain.setValueAtTime(0.001, startTime);
  carrierGain.gain.linearRampToValueAtTime(0.8, startTime + 0.09);
  carrierGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.52);

  mod.connect(carrier.frequency);
  carrier.connect(carrierGain);
  carrierGain.connect(ctx.destination);

  mod.start(startTime);
  carrier.start(startTime);
  mod.stop(startTime + 0.52);
  carrier.stop(startTime + 0.52);

  // ── 2. Heavy Brass Thali Metallic Clash (CLANGGG!) ──────────────
  const thaliTime = startTime + 0.22;
  const metalFreqs = isGrandFinale
    ? [1240, 1480, 2240, 3150, 4820, 6300, 7850, 9200]
    : [1480, 2240, 3150, 4820, 6300, 7850];

  const decayDuration = isGrandFinale ? 1.6 : 0.75;

  metalFreqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = idx % 2 === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, thaliTime);

    const vol = (isGrandFinale ? 0.65 : 0.55) / (idx + 1);
    gain.gain.setValueAtTime(vol, thaliTime);
    gain.gain.exponentialRampToValueAtTime(0.001, thaliTime + (decayDuration + idx * 0.12));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(thaliTime);
    osc.stop(thaliTime + (decayDuration + idx * 0.12));
  });
}

/** ~5.5 seconds: 3 consecutive elephant-roar + thali-clash bursts, the
 * third ringing out longer as a "grand finale." Long and distinctive
 * enough to catch attention even mid-task, hands full, or with kitchen
 * noise — the explicit ask this replaced OrderManager's old chime for. */
export function playNewOrderChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    playSingleRoarAndClash(ctx, t, false);          // Burst 1 (0.0s)
    playSingleRoarAndClash(ctx, t + 1.65, false);    // Burst 2 (1.65s)
    playSingleRoarAndClash(ctx, t + 3.30, true);     // Grand Finale Burst 3 (3.30s -> rings out to 5.5s)
  } catch (e) {
    console.error("New-order chime error:", e);
  }
}
