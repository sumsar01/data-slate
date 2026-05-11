// Terminal sounds — mechanical relay/typewriter aesthetic
// keyclick.mp3: real typewriter keystroke sample (Freesound #667418, hz37, CC BY 4.0)

let ctx: AudioContext | null = null
let keyclickBuffer: AudioBuffer | null = null
let keyclickLoading = false

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

async function loadKeyclick() {
  if (keyclickBuffer || keyclickLoading) return
  keyclickLoading = true
  try {
    const c = getCtx()
    const res = await fetch("/sounds/keyclick.mp3")
    const arr = await res.arrayBuffer()
    keyclickBuffer = await c.decodeAudioData(arr)
  } catch (_) {
    // silently fail
  }
  keyclickLoading = false
}

// Preload on first user interaction
let preloaded = false
export function preloadSounds() {
  if (preloaded) return
  preloaded = true
  loadKeyclick()
}

function play(fn: (ctx: AudioContext) => void) {
  try {
    const c = getCtx()
    if (c.state === "suspended") c.resume()
    fn(c)
  } catch (_) {}
}

// Real sample playback with optional pitch shift
function playKeyclick(playbackRate = 1.0, gain = 0.5) {
  if (!keyclickBuffer) return
  play((ctx) => {
    const src = ctx.createBufferSource()
    src.buffer = keyclickBuffer!
    src.playbackRate.value = playbackRate
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(g)
    g.connect(ctx.destination)
    src.start()
  })
}

// Mechanical noise burst — filtered white noise, sounds like a relay or solenoid
function noiseClick(frequency: number, durationMs: number, gainLevel = 0.08) {
  play((ctx) => {
    const bufSize = ctx.sampleRate * (durationMs / 1000)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf

    // Bandpass filter to make it sound mechanical, not hissy
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = frequency
    bp.Q.value = 1.2

    const g = ctx.createGain()
    const t = ctx.currentTime
    g.gain.setValueAtTime(gainLevel, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000)

    src.connect(bp)
    bp.connect(g)
    g.connect(ctx.destination)
    src.start()
    src.stop(t + durationMs / 1000 + 0.01)
  })
}

// Typewriter keystroke — real sample, slightly randomised pitch for variety
export function soundTypewriterKey() {
  if (keyclickBuffer) {
    const pitch = 0.85 + Math.random() * 0.35 // slight variation each key
    playKeyclick(pitch, 0.2)
  } else {
    // Fallback: mechanical noise burst
    noiseClick(2400 + Math.random() * 800, 35, 0.06)
  }
}

// UI click — short solenoid snap
export function soundClick() {
  noiseClick(1800, 25, 0.07)
}

// Tag toggle — slightly higher pitched snap
export function soundBeep() {
  noiseClick(3200, 20, 0.05)
}

// Boot sequence — low mechanical thud sequence
export function soundBoot() {
  play((ctx) => {
    [0, 0.15, 0.3, 0.45, 0.6].forEach((delay) => {
      const bufSize = Math.floor(ctx.sampleRate * 0.08)
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

      const src = ctx.createBufferSource()
      src.buffer = buf

      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.value = 400 + delay * 600

      const g = ctx.createGain()
      const t = ctx.currentTime + delay
      g.gain.setValueAtTime(0.12, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)

      src.connect(lp)
      lp.connect(g)
      g.connect(ctx.destination)
      src.start(t)
      src.stop(t + 0.1)
    })
  })
}
