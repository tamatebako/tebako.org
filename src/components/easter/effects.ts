import { reduced } from './feedback'
import { triggerTypeEffect } from './finale'

export function typeSequence() {
  const TARGET = 'tebako'
  let buffer = ''
  let triggered = false
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (e.key.length === 1) {
      buffer = (buffer + e.key.toLowerCase()).slice(-TARGET.length)
      if (buffer === TARGET && !triggered) {
        triggered = true
        triggerTypeEffect()
        setTimeout(() => { triggered = false }, 3000)
      }
    }
  })
}

export function cursorTrail() {
  if (reduced()) return
  const canvas = document.createElement('canvas')
  canvas.className = 'tb-cursor-canvas'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const c = ctx
  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number; hue: number }> = []
  let lastSpawn = 0
  let mouseX = -100, mouseY = -100

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX
    mouseY = e.clientY
    const now = performance.now()
    if (now - lastSpawn > 50) {
      lastSpawn = now
      particles.push({
        x: mouseX + (Math.random() - 0.5) * 6,
        y: mouseY + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.4 - Math.random() * 0.6,
        life: 1,
        size: 1.5 + Math.random() * 2,
        hue: 28 + Math.random() * 20,
      })
      if (particles.length > 30) particles.shift()
    }
  })

  function tick() {
    c.clearRect(0, 0, canvas.width, canvas.height)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.life -= 0.022
      if (p.life <= 0) { particles.splice(i, 1); continue }
      const r = p.size * p.life
      const grad = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3)
      grad.addColorStop(0, `hsla(${p.hue}, 85%, 68%, ${p.life * 0.7})`)
      grad.addColorStop(1, `hsla(${p.hue}, 85%, 68%, 0)`)
      c.fillStyle = grad
      c.beginPath()
      c.arc(p.x, p.y, r * 3, 0, Math.PI * 2)
      c.fill()
    }
    requestAnimationFrame(tick)
  }
  tick()
}

export function consoleArt() {
  console.log(
    '%c　玉　手　箱　',
    'font-size:32px;font-weight:bold;color:#c36242;line-height:1.4;text-shadow:0 0 8px rgba(248,184,131,0.5);'
  )
  console.log(
    '%cTebako — the jewel box for Ruby.',
    'font-size:14px;color:#06394a;font-weight:600;'
  )
  console.log(
    '%cType help() for a guide to hidden treasures.',
    'font-size:12px;color:#d38370;font-style:italic;'
  )
}
