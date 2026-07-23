<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface NavItem {
  label: string
  href: string
}

const props = defineProps<{ nav: NavItem[]; class?: string }>()

const open = ref(false)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

onMounted(() => {
  document.addEventListener('astro:after-swap', close)
})

onBeforeUnmount(() => {
  document.removeEventListener('astro:after-swap', close)
})
</script>

<template>
  <button
    type="button"
    :class="props.class"
    @click="toggle"
    :aria-expanded="open"
    aria-label="Toggle navigation menu"
    class="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tb-c-divider)] text-[var(--tb-c-text-1)] transition-colors hover:border-[var(--tb-c-accent)] hover:text-[var(--tb-c-accent)]"
  >
    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  </button>

  <Transition name="tb-mobile-menu">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] md:hidden"
      style="background: var(--tb-c-bg);"
    >
      <div class="flex h-16 items-center justify-between px-6">
        <span class="font-[var(--font-display)] text-lg font-medium">tebako</span>
        <button
          type="button"
          @click="close"
          aria-label="Close navigation menu"
          class="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tb-c-divider)]"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
      </div>
      <nav class="flex flex-col gap-2 px-6 py-8">
        <a
          v-for="item in nav"
          :key="item.href"
          :href="item.href"
          @click="close"
          class="border-b border-[var(--tb-c-divider)] py-4 font-[var(--font-display)] text-2xl font-medium text-[var(--tb-c-text-1)]"
        >
          {{ item.label }}
        </a>
      </nav>
    </div>
  </Transition>
</template>

<style scoped>
.tb-mobile-menu-enter-active,
.tb-mobile-menu-leave-active {
  transition: opacity 0.3s var(--ease-out-quint, ease), transform 0.3s var(--ease-out-quint, ease);
}
.tb-mobile-menu-enter-from {
  opacity: 0;
  transform: translateY(-100%);
}
.tb-mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
