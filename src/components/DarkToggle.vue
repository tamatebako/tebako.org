<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const THEME_KEY = 'tb-theme'
const isDark = ref(false)

function sync() {
  isDark.value = document.documentElement.classList.contains('dark')
}

function toggle() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  try {
    localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
  } catch {
    /* localStorage unavailable */
  }
}

onMounted(() => {
  sync()
  document.addEventListener('astro:after-swap', sync)
})

onBeforeUnmount(() => {
  document.removeEventListener('astro:after-swap', sync)
})
</script>

<template>
  <button
    type="button"
    @click="toggle"
    :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    :title="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    class="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tb-c-divider)] text-[var(--tb-c-text-2)] transition-all duration-300 hover:border-[var(--tb-c-accent)] hover:text-[var(--tb-c-accent)]"
  >
    <Transition name="tb-theme-icon" mode="out-in">
      <svg
        v-if="isDark"
        key="sun"
        viewBox="0 0 24 24"
        class="h-5 w-5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg
        v-else
        key="moon"
        viewBox="0 0 24 24"
        class="h-5 w-5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </Transition>
  </button>
</template>

<style scoped>
.tb-theme-icon-enter-active,
.tb-theme-icon-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.tb-theme-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}
.tb-theme-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}
</style>
