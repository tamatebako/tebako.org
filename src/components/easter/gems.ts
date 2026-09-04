import { playChime, spawnBurst, showToast, updateBadge } from './feedback'
import { checkFinale } from './finale'
import { ALL_GEMS, MESSAGES, getFound, saveFound, getWisdomFound, saveWisdomFound } from './storage'

function handleGemClick(e: { currentTarget: EventTarget | null }) {
  const target = e.currentTarget as HTMLElement | null
  const id = target?.dataset?.gemId
  if (!id || !ALL_GEMS.includes(id)) return
  const found = getFound()
  if (found.has(id)) return
  found.add(id)
  saveFound(found)
  target.classList.add('found')
  const rect = target.getBoundingClientRect()
  spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2)
  playChime(true)
  const total = found.size
  showToast(MESSAGES[total] || `Gem found! ${total}/${ALL_GEMS.length}`)
  updateBadge(getFound().size + getWisdomFound().size)
  checkFinale()
}

function showQuoteCard(quote: string, author: string) {
  const card = document.createElement('div')
  card.className = 'tb-quote-card'
  const text = document.createElement('p')
  text.className = 'tb-quote-text'
  text.textContent = quote
  card.appendChild(text)
  if (author) {
    const auth = document.createElement('p')
    auth.className = 'tb-quote-author'
    auth.textContent = '— ' + author
    card.appendChild(auth)
  }
  card.style.opacity = '0'
  card.style.transform = 'translate(-50%, -50%) scale(0.8)'
  document.body.appendChild(card)
  card.animate([
    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.8)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
  ], { duration: 500, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'forwards' })
  setTimeout(() => {
    card.animate([
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.95) translateY(-8px)' },
    ], { duration: 600, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' }).onfinish = () => card.remove()
  }, 5500)
}

function flyAway(startX: number, startY: number) {
  const flyer = document.createElement('div')
  flyer.className = 'tb-wisdom-flyer'
  flyer.innerHTML = '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2 L16 8 L10 18 L4 8 Z" fill="currentColor"/><path d="M4 8 L16 8 M10 2 L10 18" stroke="currentColor" stroke-width="0.5" opacity="0.3"/></svg>'
  flyer.style.left = startX + 'px'
  flyer.style.top = startY + 'px'
  flyer.style.transform = 'translate(-50%, -50%)'
  document.body.appendChild(flyer)

  const flyDist = window.innerHeight + 200
  const drift = (Math.random() - 0.5) * 200

  flyer.animate([
    { transform: 'translate(-50%, -50%) scale(1.5) rotate(0deg)', opacity: 1 },
    { transform: `translate(calc(-50% + ${drift * 0.3}px), calc(-50% - ${flyDist * 0.3}px)) scale(1.2) rotate(240deg)`, opacity: 0.8, offset: 0.3 },
    { transform: `translate(calc(-50% + ${drift}px), calc(-50% - ${flyDist}px)) scale(0.2) rotate(720deg)`, opacity: 0 },
  ], { duration: 1800, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' }).onfinish = () => flyer.remove()

  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      spawnBurst(
        startX + (Math.random() - 0.5) * 24,
        startY - i * 30 - 20
      )
    }, i * 120)
  }
}

function handleWisdomClick(e: { currentTarget: EventTarget | null }) {
  const gem = e.currentTarget as HTMLElement | null
  if (!gem || gem.classList.contains('collected')) return
  const quote = gem.dataset.quote || ''
  const author = gem.dataset.author || ''
  const id = gem.dataset.wisdomId

  const rect = gem.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  playChime(true)

  gem.animate([
    { transform: 'scale(1) rotate(0deg)' },
    { transform: 'scale(1.8) rotate(15deg)', offset: 0.4 },
    { transform: 'scale(1.5) rotate(-5deg)', offset: 0.7 },
    { transform: 'scale(1.2) rotate(0deg)' },
  ], { duration: 400, easing: 'cubic-bezier(0.34,1.56,0.64,1)' })

  setTimeout(() => {
    showQuoteCard(quote, author)
    flyAway(cx, cy)
    gem.classList.add('collected')
    if (id) {
      const found = getWisdomFound()
      found.add(id)
      saveWisdomFound(found)
    }
    var combined = getFound().size + getWisdomFound().size
    updateBadge(combined)
    checkFinale()
  }, 350)
}

function initWisdomGems() {
  const found = getWisdomFound()
  document.querySelectorAll<HTMLElement>('[data-wisdom-id]').forEach((el) => {
    const id = el.dataset.wisdomId
    if (id && found.has(id)) {
      el.classList.add('collected')
    } else {
      el.classList.remove('collected')
      el.addEventListener('click', handleWisdomClick, { once: true })
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleWisdomClick({ currentTarget: el })
        }
      })
    }
  })
}

export function initGems() {
  const found = getFound()
  document.querySelectorAll<HTMLElement>('[data-gem-id]').forEach((el) => {
    const id = el.dataset.gemId
    if (id && found.has(id)) {
      el.classList.add('found')
    } else {
      el.classList.remove('found')
      el.addEventListener('click', handleGemClick, { once: true })
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleGemClick({ currentTarget: el })
        }
      })
    }
  })
  initWisdomGems()
  var combined = getFound().size + getWisdomFound().size
  if (combined > 0) updateBadge(combined)
}
