<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const scene = ref<HTMLElement | null>(null)
const frame = ref<HTMLElement | null>(null)
const gem = ref<HTMLElement | null>(null)
const halo = ref<HTMLElement | null>(null)
const interiorGlow = ref<HTMLElement | null>(null)

const opened = ref(false)
const hintVisible = ref(true)
const isIdle = ref(false)

const RAY_COUNT = 12
const SPARKLE_COUNT = 18

const rays = Array.from({ length: RAY_COUNT }, (_, i) => i)
const sparkles = Array.from({ length: SPARKLE_COUNT }, (_, i) => i)

let active: Animation[] = []
let idle: Animation | null = null
let hintTimer: Animation | null = null
let autoClose: ReturnType<typeof setTimeout> | null = null

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const QUINT = 'cubic-bezier(0.22, 1, 0.36, 1)'

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function cancelAll() {
  active.forEach((a) => a.cancel())
  active = []
  if (idle) { idle.cancel(); idle = null }
  if (hintTimer) { hintTimer.cancel(); hintTimer = null }
  if (autoClose) { clearTimeout(autoClose); autoClose = null }
}

function playOpen() {
  if (opened.value) return
  cancelAll()
  opened.value = true
  hintVisible.value = false

  const frameEl = frame.value!
  const gemEl = gem.value!
  const haloEl = halo.value!
  const glowEl = interiorGlow.value!
  const sceneEl = scene.value!

  active.push(
    frameEl.animate(
      [
        { filter: 'brightness(1) drop-shadow(0 0 0px rgba(237,0,51,0))' },
        { filter: 'brightness(1.15) drop-shadow(0 0 50px rgba(237,0,51,0.35))' },
      ],
      { duration: 900, easing: QUINT, fill: 'forwards' }
    )
  )

  active.push(
    glowEl.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.4)' },
        { opacity: 0.9, transform: 'translate(-50%, -50%) scale(1.8)' },
      ],
      { duration: 700, delay: 200, easing: QUINT, fill: 'forwards' }
    )
  )

  active.push(
    gemEl.animate(
      [
        { transform: 'translate(-50%, 0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(1.35) rotate(6deg)', opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%, -72%) scale(1.15) rotate(-4deg)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-50%, -68%) scale(1.1) rotate(0deg)', opacity: 1 },
      ],
      { duration: 1600, delay: 300, easing: SPRING, fill: 'forwards' }
    )
  )

  active.push(
    gemEl.animate(
      [
        { filter: 'drop-shadow(0 0 6px rgba(237,0,51,0.4)) drop-shadow(0 0 12px rgba(248,184,131,0.2))' },
        { filter: 'drop-shadow(0 0 20px rgba(237,0,51,0.8)) drop-shadow(0 0 40px rgba(248,184,131,0.6)) drop-shadow(0 0 60px rgba(211,131,112,0.3))' },
      ],
      { duration: 800, delay: 400, easing: QUINT, fill: 'forwards' }
    )
  )

  active.push(
    haloEl.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3)' },
        { opacity: 0.6, transform: 'translate(-50%, -50%) scale(2.2)' },
      ],
      { duration: 1400, delay: 600, easing: QUINT, fill: 'forwards' }
    )
  )

  const rayEls = sceneEl.querySelectorAll<HTMLElement>('.tb-ray')
  rayEls.forEach((ray, i) => {
    const angle = (360 / rayEls.length) * i
    active.push(
      ray.animate(
        [
          { opacity: 0, transform: `rotate(${angle}deg) translateX(-50%) scaleY(0)` },
          { opacity: 0.75, transform: `rotate(${angle}deg) translateX(-50%) scaleY(1)`, offset: 0.4 },
          { opacity: 0, transform: `rotate(${angle}deg) translateX(-50%) scaleY(1.6)` },
        ],
        { duration: 1900, delay: 700 + i * 35, easing: QUINT }
      )
    )
  })

  const sparkleEls = sceneEl.querySelectorAll<HTMLElement>('.tb-sparkle')
  sparkleEls.forEach((s, i) => {
    const angle = (Math.PI * 2 * i) / sparkleEls.length + (Math.random() - 0.5) * 0.8
    const dist = 100 + Math.random() * 90
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 80
    active.push(
      s.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% + ${dy * 0.4}px)) scale(1) rotate(90deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy - 90}px)) scale(0) rotate(200deg)`, opacity: 0 },
        ],
        { duration: 2600, delay: 800 + i * 50, easing: QUINT }
      )
    )
  })

  idle = gemEl.animate(
    [
      { transform: 'translate(-50%, -68%) scale(1.1) rotate(0deg)' },
      { transform: 'translate(-50%, -73%) scale(1.13) rotate(2deg)' },
      { transform: 'translate(-50%, -68%) scale(1.1) rotate(0deg)' },
    ],
    { duration: 4200, delay: 2200, iterations: Infinity, easing: 'ease-in-out' }
  )

  autoClose = setTimeout(() => closeBox(), 15000)
}

function closeBox() {
  cancelAll()
  opened.value = false

  const frameEl = frame.value
  const gemEl = gem.value
  const haloEl = halo.value
  const glowEl = interiorGlow.value
  if (!frameEl || !gemEl || !haloEl || !glowEl) return

  active.push(
    gemEl.animate(
      [
        { transform: 'translate(-50%, -68%) scale(1.1) rotate(0deg)', opacity: 1 },
        { transform: 'translate(-50%, 0) scale(1) rotate(0deg)', opacity: 1 },
      ],
      { duration: 700, easing: QUINT, fill: 'forwards' }
    )
  )

  active.push(
    gemEl.animate(
      [
        { filter: 'drop-shadow(0 0 20px rgba(237,0,51,0.8)) drop-shadow(0 0 40px rgba(248,184,131,0.6)) drop-shadow(0 0 60px rgba(211,131,112,0.3))' },
        { filter: 'drop-shadow(0 0 6px rgba(237,0,51,0.4)) drop-shadow(0 0 12px rgba(248,184,131,0.2))' },
      ],
      { duration: 600, easing: 'ease-in', fill: 'forwards' }
    )
  )

  active.push(
    glowEl.animate(
      [
        { opacity: 0.9, transform: 'translate(-50%, -50%) scale(1.8)' },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.4)' },
      ],
      { duration: 500, delay: 200, easing: 'ease-in', fill: 'forwards' }
    )
  )

  active.push(
    haloEl.animate(
      [
        { opacity: 0.6, transform: 'translate(-50%, -50%) scale(2.2)' },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3)' },
      ],
      { duration: 500, easing: 'ease-in', fill: 'forwards' }
    )
  )

  active.push(
    frameEl.animate(
      [
        { filter: 'brightness(1.15) drop-shadow(0 0 50px rgba(237,0,51,0.35))' },
        { filter: 'brightness(1) drop-shadow(0 0 0px rgba(237,0,51,0))' },
      ],
      { duration: 600, delay: 200, easing: QUINT, fill: 'forwards' }
    )
  )

  setTimeout(() => {
    if (!opened.value) {
      hintVisible.value = true
      startHint()
    }
  }, 900)
}

function toggle() {
  opened.value ? closeBox() : playOpen()
}

function startHint() {
  const gemEl = gem.value
  if (!gemEl) return
  hintTimer = gemEl.animate(
    [
      { filter: 'drop-shadow(0 0 4px rgba(237,0,51,0.3))' },
      { filter: 'drop-shadow(0 0 12px rgba(237,0,51,0.6))' },
      { filter: 'drop-shadow(0 0 4px rgba(237,0,51,0.3))' },
    ],
    { duration: 2800, iterations: Infinity, easing: 'ease-in-out' }
  )
}

let idleTimer: ReturnType<typeof setTimeout> | null = null

function resetIdle() {
  clearTimeout(idleTimer)
  isIdle.value = false
  idleTimer = setTimeout(() => {
    if (!opened.value) {
      isIdle.value = true
    }
  }, 30000)
}

onMounted(() => {
  setTimeout(() => startHint(), 800)
  resetIdle()
  document.addEventListener('mousemove', resetIdle, { passive: true })
  document.addEventListener('scroll', resetIdle, { passive: true })
  document.addEventListener('keydown', resetIdle, { passive: true })
  document.addEventListener('touchstart', resetIdle, { passive: true })
})

onBeforeUnmount(() => {
  cancelAll()
  clearTimeout(idleTimer)
  document.removeEventListener('mousemove', resetIdle)
  document.removeEventListener('scroll', resetIdle)
  document.removeEventListener('keydown', resetIdle)
  document.removeEventListener('touchstart', resetIdle)
})
</script>

<template>
  <div ref="scene" class="tb-jewel-scene" :class="{ 'is-idle': isIdle }">
    <div ref="halo" class="tb-halo" />

    <div class="tb-rays">
      <span v-for="i in rays" :key="'ray-' + i" class="tb-ray" />
    </div>

    <button
      ref="frame"
      type="button"
      class="tb-logo-frame"
      :aria-label="opened ? 'Return the jewel to the box' : 'Open the jewel box'"
      @click="toggle"
    >
      <img
        src="/branding/tebako-logo_logo-ruby-empty.svg"
        alt=""
        class="tb-box-layer"
        loading="eager"
        draggable="false"
      />
      <div ref="interiorGlow" class="tb-interior-glow" />
    </button>

    <img
      ref="gem"
      src="/branding/tebako-logo_logo-ruby-gem.svg"
      alt=""
      class="tb-gem-layer"
      :class="{ 'is-flying': opened }"
      draggable="false"
    />

    <div class="tb-sparkles">
      <span v-for="i in sparkles" :key="'spark-' + i" class="tb-sparkle" />
    </div>

    <Transition name="tb-hint">
      <p v-if="hintVisible && !opened" class="tb-hint">
        <span class="tb-hint-dot" />
        <template v-if="isIdle">the box is waiting...</template>
        <template v-else>click to open</template>
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.tb-jewel-scene {
  position: relative;
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tb-halo {
  position: absolute;
  top: 25%;
  left: 50%;
  width: 340px;
  height: 340px;
  max-width: 80%;
  max-height: 80%;
  transform: translate(-50%, -50%) scale(0.3);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(237, 0, 51, 0.25) 0%,
    rgba(248, 184, 131, 0.18) 30%,
    rgba(211, 131, 112, 0.1) 55%,
    transparent 75%
  );
  opacity: 0;
  pointer-events: none;
  z-index: 0;
  filter: blur(6px);
}

.tb-rays {
  position: absolute;
  top: 25%;
  left: 50%;
  width: 0;
  height: 0;
  z-index: 1;
  pointer-events: none;
}

.tb-ray {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 260px;
  margin-left: -2.5px;
  background: linear-gradient(
    to top,
    rgba(255, 220, 200, 0.95) 0%,
    rgba(248, 184, 131, 0.5) 50%,
    rgba(237, 0, 51, 0.2) 80%,
    transparent 100%
  );
  transform-origin: 50% 0%;
  border-radius: 3px;
  opacity: 0;
}

.tb-logo-frame {
  position: relative;
  width: 78%;
  max-width: 340px;
  aspect-ratio: 610 / 633;
  border: none;
  border-radius: 0;
  padding: 0;
  cursor: pointer;
  background: transparent;
  overflow: visible;
  box-shadow: none;
  z-index: 2;
  transition: transform 0.4s var(--ease-out-quint, ease);
}

.tb-logo-frame:hover {
  transform: scale(1.02);
}

.tb-logo-frame:focus-visible {
  outline: 3px solid var(--tb-c-accent);
  outline-offset: 8px;
  border-radius: 16px;
}

.tb-jewel-scene.is-idle .tb-logo-frame {
  animation: none;
}

.tb-box-layer {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
}

.tb-interior-glow {
  position: absolute;
  top: 38%;
  left: 50%;
  width: 35%;
  height: 35%;
  transform: translate(-50%, -50%) scale(0.4);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 200, 180, 0.7) 0%,
    rgba(237, 0, 51, 0.3) 30%,
    rgba(248, 184, 131, 0.15) 60%,
    transparent 80%
  );
  opacity: 0;
  pointer-events: none;
  z-index: 1;
  filter: blur(6px);
}

.tb-gem-layer {
  position: absolute;
  top: 30%;
  left: 50%;
  width: 25%;
  aspect-ratio: 149.54 / 155.15;
  transform: translate(-50%, 0);
  z-index: 4;
  pointer-events: none;
  filter:
    drop-shadow(0 0 6px rgba(237, 0, 51, 0.4))
    drop-shadow(0 0 12px rgba(248, 184, 131, 0.2));
  will-change: transform, filter;
  animation: tb-gem-bob 5s ease-in-out infinite;
}

.tb-gem-layer.is-flying {
  animation: none;
}

@keyframes tb-gem-bob {
  0%, 100% {
    transform: translate(-50%, 0) rotate(0deg);
  }
  20% {
    transform: translate(-49%, -6px) rotate(1.5deg);
  }
  40% {
    transform: translate(-51%, -3px) rotate(-1deg);
  }
  60% {
    transform: translate(-50%, -8px) rotate(0.5deg);
  }
  80% {
    transform: translate(-48.5%, -4px) rotate(-1.5deg);
  }
}

.tb-sparkles {
  position: absolute;
  top: 25%;
  left: 50%;
  width: 0;
  height: 0;
  z-index: 3;
  pointer-events: none;
}

.tb-sparkle {
  position: absolute;
  top: 0;
  left: 0;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  transform: translate(-50%, -50%) scale(0);
  background: var(--color-gold);
  border-radius: 50%;
  box-shadow:
    0 0 6px rgba(237, 0, 51, 0.9),
    0 0 12px rgba(248, 184, 131, 0.6),
    0 0 20px rgba(248, 184, 131, 0.3);
  opacity: 0;
}

.tb-hint {
  position: absolute;
  bottom: -2%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--tb-c-accent);
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  background: var(--tb-c-bg-soft);
  border: 1px solid var(--tb-c-divider);
  box-shadow: var(--tb-shadow-card);
  animation: tb-hint-bob 2.5s ease-in-out infinite;
}

@keyframes tb-hint-bob {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(4px); }
}

.tb-hint-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tb-c-accent);
  animation: tb-hint-blink 2s ease-in-out infinite;
}

@keyframes tb-hint-blink {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.4); }
}

.tb-hint-enter-active,
.tb-hint-leave-active {
  transition: opacity 0.4s ease;
}
.tb-hint-enter-from,
.tb-hint-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .tb-jewel-scene {
    max-width: 340px;
  }
  .tb-logo-frame {
    max-width: 270px;
  }
}
</style>
