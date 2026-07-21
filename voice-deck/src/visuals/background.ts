interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hue: number
}

const PARTICLES = 110

/**
 * Рефлекторный контур: фон «дышит» вместе с голосом через AnalyserNode.
 * Без микрофона (или до выдачи прав) работает синтетический режим,
 * чтобы сцена никогда не выглядела мёртвой.
 */
export class ReactiveBackground {
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private analyser: AnalyserNode | null = null
  private data: Uint8Array | null = null
  private level = 0
  private pulse = 0
  private raf = 0
  private t = 0

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    this.ctx = ctx
    this.resize()
    window.addEventListener('resize', () => this.resize())
    for (let i = 0; i < PARTICLES; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2 - Math.random() * 0.6,
        r: 1 + Math.random() * 2.5,
        hue: Math.random() * 60 - 30,
      })
    }
  }

  async attachMic(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ac = new AudioContext()
      const src = ac.createMediaStreamSource(stream)
      const an = ac.createAnalyser()
      an.fftSize = 512
      src.connect(an)
      this.analyser = an
      this.data = new Uint8Array(an.fftSize)
      return true
    } catch {
      return false
    }
  }

  /** Всплеск при смене слайда. */
  kick(): void {
    this.pulse = 1
  }

  getLevel(): number {
    return this.level
  }

  start(): void {
    const loop = () => {
      this.t += 1 / 60
      this.measure()
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
  }

  private measure(): void {
    let target: number
    if (this.analyser && this.data) {
      this.analyser.getByteTimeDomainData(this.data)
      let sum = 0
      for (let i = 0; i < this.data.length; i++) {
        const d = (this.data[i] - 128) / 128
        sum += d * d
      }
      target = Math.min(1, Math.sqrt(sum / this.data.length) * 4)
    } else {
      target = 0.14 + 0.08 * Math.sin(this.t * 0.9) + 0.05 * Math.sin(this.t * 2.3)
    }
    // сглаживание: быстро вверх, медленно вниз — фон «дышит», а не мигает
    this.level += (target - this.level) * (target > this.level ? 0.35 : 0.06)
    this.pulse *= 0.94
  }

  private draw(): void {
    const { ctx, canvas } = this
    const w = canvas.width
    const h = canvas.height
    const energy = Math.min(1.4, this.level * 1.6 + this.pulse)

    ctx.fillStyle = '#0a0d18'
    ctx.fillRect(0, 0, w, h)

    const grad = ctx.createRadialGradient(w / 2, h * 0.95, 0, w / 2, h * 0.95, h * 1.1)
    const hue = 222 + energy * 40
    grad.addColorStop(0, `hsla(${hue}, 85%, 55%, ${0.16 + energy * 0.2})`)
    grad.addColorStop(1, 'rgba(10, 13, 24, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    for (const p of this.particles) {
      const speed = 0.4 + energy * 2.4
      p.x += p.vx * speed
      p.y += p.vy * speed
      if (p.y < -10) {
        p.y = h + 10
        p.x = Math.random() * w
      }
      if (p.x < -10) p.x = w + 10
      if (p.x > w + 10) p.x = -10
      const r = p.r * (1 + energy * 1.2)
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${hue + p.hue}, 80%, 65%, ${0.25 + energy * 0.3})`
      ctx.fill()
    }
  }

  private resize(): void {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }
}
