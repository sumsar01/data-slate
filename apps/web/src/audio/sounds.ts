// Terminal sounds — pure Web Audio synthesis, no samples needed
// Fallout terminal aesthetic: tight electronic blips, relay ticks, CRT hum

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function play(fn: (ctx: AudioContext) => void) {
  try {
    const c = getCtx()
    if (c.state === "suspended") {
      c.resume().then(() => fn(c)).catch(() => {})
    } else {
      fn(c)
    }
  } catch { /* AudioContext unavailable — silently ignore */ }
}

export function preloadSounds() {
  // Ensure AudioContext is created on first user gesture
  try { getCtx() } catch { /* preload only — ignore if context unavailable */ }
}

// ─── Core synth primitives ─────────────────────────────────────────────────

function noiseBurst(
  ctx: AudioContext,
  durationMs: number,
  filterFreq: number,
  filterQ: number,
  gainLevel: number,
  pitchShift = 1.0,
) {
  const bufSize = Math.ceil(ctx.sampleRate * (durationMs / 1000))
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = pitchShift

  const bp = ctx.createBiquadFilter()
  bp.type = "bandpass"
  bp.frequency.value = filterFreq * pitchShift
  bp.Q.value = filterQ

  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(gainLevel, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000)

  src.connect(bp)
  bp.connect(g)
  g.connect(ctx.destination)
  src.start(t)
  src.stop(t + durationMs / 1000 + 0.01)
}

function sineBlip(
  ctx: AudioContext,
  freq: number,
  durationMs: number,
  gainLevel: number,
  startOffset = 0,
) {
  const osc = ctx.createOscillator()
  osc.type = "sine"
  osc.frequency.value = freq

  const g = ctx.createGain()
  const t = ctx.currentTime + startOffset
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gainLevel, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000)

  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + durationMs / 1000 + 0.01)
}

// ─── Public sound effects ──────────────────────────────────────────────────

// Typewriter character blip — punchy electronic tick, pitch-varied
// Fires every N characters during text reveal
export function soundTerminalBlip() {
  play((ctx) => {
    const pitch = 0.88 + Math.random() * 0.28 // ±15% pitch variation
    noiseBurst(ctx, 10, 2800, 2.5, 0.09, pitch)
    sineBlip(ctx, 920 * pitch, 8, 0.04)
  })
}

// Boot line tick — softer, each line printed
export function soundLineTick() {
  play((ctx) => {
    noiseBurst(ctx, 8, 1400, 3.0, 0.06)
  })
}

// Boot [ OK ] confirm — higher, crisper
export function soundLineOK() {
  play((ctx) => {
    noiseBurst(ctx, 7, 2000, 3.5, 0.05)
    sineBlip(ctx, 1100, 12, 0.035, 0.005)
  })
}

// Boot WARNING — lower, harsher
export function soundWarning() {
  play((ctx) => {
    noiseBurst(ctx, 20, 600, 1.0, 0.10)
    sineBlip(ctx, 280, 18, 0.06)
  })
}

// UI click — short solenoid snap (nav, selections)
export function soundClick() {
  play((ctx) => {
    noiseBurst(ctx, 12, 1800, 2.0, 0.07)
  })
}

// Boot power-on hum — CRT warming up
let bootHumNode: OscillatorNode | null = null
export function soundBootHum() {
  play((ctx) => {
    if (bootHumNode) { try { bootHumNode.stop() } catch { /* already stopped */ } }

    const osc = ctx.createOscillator()
    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(55, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.9)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.05)
    g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.9)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)

    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 400

    osc.connect(lp)
    lp.connect(g)
    g.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 1.3)
    bootHumNode = osc
  })
}
