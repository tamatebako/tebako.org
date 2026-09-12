import { playChime, flashGold, showToast } from './feedback'
import { getFound, getWisdomFound } from './storage'

export function sweepGem() {
  const el = document.createElement('div')
  const size = 14 + Math.random() * 50
  const opacity = 0.12 + Math.random() * 0.68
  const fromLeft = Math.random() > 0.5
  const startX = fromLeft ? -size * 2 : window.innerWidth + size * 2
  const endX = fromLeft ? window.innerWidth + size * 2 : -size * 2
  const y = 5 + Math.random() * 90
  const spin = (fromLeft ? 1 : -1) * (360 + Math.random() * 1080)
  const duration = 2200 + Math.random() * 2600
  const colors = ['#f8b883', '#d38370', '#c36242', '#ed0033', '#fbd9a8']
  const color = colors[Math.floor(Math.random() * colors.length)]
  const bobAmp = 8 + Math.random() * 20

  el.style.cssText =
    'position:fixed;z-index:9992;pointer-events:none;will-change:transform,opacity;' +
    'width:' + size + 'px;height:' + size + 'px;' +
    'top:' + y + '%;left:' + startX + 'px;' +
    'color:' + color + ';' +
    'filter:drop-shadow(0 0 ' + (size * 0.15) + 'px ' + color + ');'
  el.innerHTML =
    '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">' +
    '<path d="M10 2 L16 8 L10 18 L4 8 Z" fill="currentColor"/>' +
    '<path d="M4 8 L16 8 M10 2 L10 18" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>' +
    '</svg>'

  document.body.appendChild(el)

  const dist = endX - startX
  el.animate([
    { transform: 'translateX(0) translateY(0) rotate(0deg)', opacity: 0 },
    { transform: 'translateX(' + (dist * 0.15) + 'px) translateY(' + bobAmp + 'px) rotate(' + (spin * 0.15) + 'deg)', opacity: opacity, offset: 0.15 },
    { transform: 'translateX(' + (dist * 0.4) + 'px) translateY(' + (-bobAmp * 0.8) + 'px) rotate(' + (spin * 0.4) + 'deg)', opacity: opacity, offset: 0.4 },
    { transform: 'translateX(' + (dist * 0.6) + 'px) translateY(' + (bobAmp * 0.6) + 'px) rotate(' + (spin * 0.6) + 'deg)', opacity: opacity, offset: 0.6 },
    { transform: 'translateX(' + (dist * 0.85) + 'px) translateY(' + (-bobAmp * 0.4) + 'px) rotate(' + (spin * 0.85) + 'deg)', opacity: opacity, offset: 0.85 },
    { transform: 'translateX(' + dist + 'px) translateY(0) rotate(' + spin + 'deg)', opacity: 0 },
  ], { duration: duration, easing: 'linear' }).onfinish = function () { el.remove() }
}

export function triggerTypeEffect() {
  playChime(true)
  flashGold(1500)
  for (var i = 0; i < 22; i++) {
    setTimeout(sweepGem, i * 40 + Math.random() * 300)
  }
  showToast('The treasures tumble forth.')
}

let finaleDone = false

export function checkFinale() {
  const combined = getFound().size + getWisdomFound().size
  if (combined >= 11 && !finaleDone) {
    finaleDone = true
    setTimeout(triggerFinale, 800)
  }
}

function triggerFinale() {
  playChime(true)
  for (var i = 0; i < 35; i++) {
    setTimeout(sweepGem, i * 35 + Math.random() * 400)
  }
  flashGold(2000)
  setTimeout(showLorePopup, 1500)
}

function showLorePopup() {
  var existing = document.querySelector('.tb-lore-overlay')
  if (existing) return
  var overlay = document.createElement('div')
  overlay.className = 'tb-lore-overlay'
  overlay.innerHTML =
    '<div class="tb-lore-card">' +
    '<div class="tb-lore-kanji">永</div>' +
    '<p class="tb-lore-eyebrow">An Alternative Telling of the Tamatebako</p>' +
    '<h2 class="tb-lore-title">The Keeper of the Box</h2>' +
    '<div class="tb-lore-body">' +
    '<p>In the original tale, Urashima Tarō opened the box — and three hundred years rushed out at once, aging him in an instant.</p>' +
    '<p>But there is another version.</p>' +
    '<p>In this telling, <strong>Urashima does not open the box.</strong></p>' +
    '<p>He stands on the shore, grief-stricken, the world he knew turned to dust. The casket sits heavy in his hands. His fingers find the clasp. But he remembers the princess and her single instruction.</p>' +
    '<p><em>Do not open it.</em></p>' +
    '<p>He doesn\'t.</p>' +
    '<p>Instead, he <strong>carries the box.</strong> For the rest of his long, unaging life, he walks the coast of Japan, the tamatebako held close. The years inside it — preserved, perfect, untouched by time.</p>' +
    '<p>People come to him with their sorrows. He listens. And sometimes, when the sorrow is great enough, he opens the box — just a crack, just for a moment — and a single day of the Dragon Palace\'s warmth escapes into the world.</p>' +
    '<p>The sorrow eases. The box closes. And Urashima walks on.</p>' +
    '<p>He understands, now, what Otohime knew: the box was never a punishment. It was a <strong>reservoir of better days</strong> — carried through worse ones, opened sparingly, when the world needs it most.</p>' +
    '<div class="tb-lore-divider">◆ ◆ ◆</div>' +
    '<p style="text-align:center; font-size:1rem; color:var(--color-gold);">This is tebako.</p>' +
    '<p style="text-align:center;">Not the box that destroys when opened. The box that <strong>preserves when carried.</strong></p>' +
    '<p style="text-align:center; color:var(--color-mist); font-size:0.85rem;">Your code — held safe inside, ready to run wherever it is needed.</p>' +
    '</div>' +
    '<button class="tb-lore-close" type="button">Carry the box →</button>' +
    '</div>'
  document.body.appendChild(overlay)
  overlay.querySelector('.tb-lore-close')?.addEventListener('click', function () {
    overlay.classList.remove('visible')
    setTimeout(function () { overlay.remove() }, 600)
  })
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      overlay.classList.remove('visible')
      setTimeout(function () { overlay.remove() }, 600)
    }
  })
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { overlay.classList.add('visible') })
  })
}
