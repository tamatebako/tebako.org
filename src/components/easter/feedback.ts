export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function playChime(rising = true) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    const notes = rising ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.08
      gain.gain.setValueAtTime(0.001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.6)
    })
  } catch { /* audio unavailable */ }
}

export function spawnBurst(x: number, y: number) {
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('div')
    s.className = 'tb-gem-sparkle'
    s.style.left = x + 'px'
    s.style.top = y + 'px'
    document.body.appendChild(s)
    const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3
    const dist = 40 + Math.random() * 40
    s.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 20}px) scale(0)`, opacity: 0 },
    ], { duration: 800 + Math.random() * 300, easing: 'cubic-bezier(0.22,1,0.36,1)' }).onfinish = () => s.remove()
  }
}

export function showToast(msg: string) {
  const t = document.createElement('div')
  t.className = 'tb-gem-toast'
  t.textContent = msg
  document.body.appendChild(t)
  t.animate([
    { opacity: 0, transform: 'translate(-50%, 16px)' },
    { opacity: 1, transform: 'translate(-50%, 0)' },
  ], { duration: 400, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' })
  setTimeout(() => {
    t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%, -8px)' }],
      { duration: 500, fill: 'forwards' }).onfinish = () => t.remove()
  }, 3200)
}

export const BADGE_TOTAL = 19

export function updateBadge(total: number) {
  const badge = document.getElementById('tb-gem-badge')
  if (!badge) return
  const count = badge.querySelector('.tb-gem-badge-count')
  if (total > 0) {
    badge.style.display = 'flex'
    if (count) count.textContent = total + '/' + BADGE_TOTAL
    badge.animate([
      { transform: 'scale(0.8)' },
      { transform: 'scale(1.1)' },
      { transform: 'scale(1)' },
    ], { duration: 400, easing: 'cubic-bezier(0.34,1.56,0.64,1)' })
  }
}

export function flashGold(ms: number) {
  document.documentElement.classList.add('tb-flash-gold')
  setTimeout(() => document.documentElement.classList.remove('tb-flash-gold'), ms)
}
