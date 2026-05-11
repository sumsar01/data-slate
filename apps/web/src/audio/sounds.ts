// Web Audio API terminal sounds — no audio files required

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function play(fn: (ctx: AudioContext) => void) {
  try {
    const c = getCtx()
    if (c.state === "suspended") c.resume()
    fn(c)
  } catch (_) {
    // silently fail if audio not available
  }
}

export function soundClick() {
  play((ctx) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = "square"
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.04)
    g.gain.setValueAtTime(0.15, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.06)
  })
}

export function soundBeep() {
  play((ctx) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = "sine"
    o.frequency.setValueAtTime(660, ctx.currentTime)
    g.gain.setValueAtTime(0.1, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.08)
  })
}

export function soundBoot() {
  play((ctx) => {
    const notes = [220, 277, 330, 440, 554]
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = "sawtooth"
      o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.12)
      g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.12 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.1)
      o.start(ctx.currentTime + i * 0.12)
      o.stop(ctx.currentTime + i * 0.12 + 0.12)
    })
  })
}

export function soundChime() {
  play((ctx) => {
    const freqs = [523, 659, 784, 1047]
    freqs.forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = "sine"
      o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08)
      g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.4)
      o.start(ctx.currentTime + i * 0.08)
      o.stop(ctx.currentTime + i * 0.08 + 0.4)
    })
  })
}
