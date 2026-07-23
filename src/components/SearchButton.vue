<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const open = ref(false)
const query = ref('')
const results = ref<Array<{ url: string; meta: { title?: string }; excerpt?: string; raw_content?: string; weighted_locations?: Array<{ weight: number }> }>>([])
const loading = ref(false)
const available = ref(true)
let pagefind: any = null
let debounce: ReturnType<typeof setTimeout> | null = null

async function loadPagefind() {
  if (pagefind) return pagefind
  try {
    pagefind = await import(/* @vite-ignore */ '/pagefind/pagefind-entry.js')
    await pagefind.init({})
  } catch {
    pagefind = null
    available.value = false
  }
  return pagefind
}

async function doSearch() {
  if (!query.value.trim()) {
    results.value = []
    return
  }
  loading.value = true
  const pf = await loadPagefind()
  if (!pf) {
    loading.value = false
    return
  }
  try {
    const search = await pf.search(query.value)
    const top = await Promise.all(
      search.results.slice(0, 8).map((r: any) => r.data())
    )
    results.value = top
  } catch {
    results.value = []
  }
  loading.value = false
}

function onInput() {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(doSearch, 200)
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    loadPagefind()
    setTimeout(() => {
      const input = document.querySelector('.tb-search-input') as HTMLInputElement | null
      input?.focus()
    }, 100)
  }
}

function close() {
  open.value = false
}

function highlight(result: any): string {
  if (!result?.excerpt) return ''
  return result.excerpt.replace(/<mark>/g, '<span style="color: var(--tb-c-accent); font-weight: 600;">').replace(/<\/mark>/g, '</span>')
}

onMounted(() => {
  document.addEventListener('astro:after-swap', close)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      toggle()
    }
    if (e.key === 'Escape' && open.value) close()
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('astro:after-swap', close)
})
</script>

<template>
  <button
    type="button"
    @click="toggle"
    aria-label="Search"
    class="flex h-10 items-center gap-2 rounded-full border border-[var(--tb-c-divider)] px-3 text-[var(--tb-c-text-3)] transition-colors hover:border-[var(--tb-c-accent)] hover:text-[var(--tb-c-accent)]"
  >
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
    <span class="hidden font-[var(--font-mono)] text-xs sm:inline">⌘K</span>
  </button>

  <Transition name="tb-search">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]"
      style="background: rgba(3, 29, 40, 0.7); backdrop-filter: blur(4px);"
      @click.self="close"
    >
      <div
        class="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--tb-c-divider-strong)] shadow-2xl"
        style="background: var(--tb-c-bg);"
      >
        <div class="flex items-center gap-3 border-b border-[var(--tb-c-divider)] px-4 py-3">
          <svg viewBox="0 0 24 24" class="h-5 w-5 text-[var(--tb-c-text-3)]" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            v-model="query"
            @input="onInput"
            class="tb-search-input flex-1 bg-transparent text-[var(--tb-c-text-1)] outline-none placeholder:text-[var(--tb-c-text-3)]"
            placeholder="Search tebako.org..."
            type="text"
          />
          <button
            @click="close"
            class="rounded-md border border-[var(--tb-c-divider)] px-2 py-0.5 font-[var(--font-mono)] text-xs text-[var(--tb-c-text-3)]"
          >
            ESC
          </button>
        </div>

        <div class="max-h-[50vh] overflow-y-auto">
          <div v-if="loading" class="px-4 py-8 text-center text-sm text-[var(--tb-c-text-3)]">
            Searching...
          </div>
          <div v-else-if="!available" class="px-4 py-8 text-center text-sm text-[var(--tb-c-text-3)]">
            Search index builds on deploy. Available in production.
          </div>
          <div v-else-if="query && results.length === 0" class="px-4 py-8 text-center text-sm text-[var(--tb-c-text-3)]">
            No results for "{{ query }}"
          </div>
          <div v-else-if="!query" class="px-4 py-8 text-center text-sm text-[var(--tb-c-text-3)]">
            Type to search the documentation and blog.
          </div>
          <a
            v-for="result in results"
            :key="result.url"
            :href="result.url"
            @click="close"
            class="block border-b border-[var(--tb-c-divider)] px-4 py-3 transition-colors last:border-0 hover:bg-[var(--tb-c-divider)]"
          >
            <p class="font-medium text-[var(--tb-c-text-1)]">{{ result.meta?.title || result.url }}</p>
            <p
              v-if="result.excerpt"
              class="mt-1 text-sm leading-snug text-[var(--tb-c-text-2)]"
              v-html="highlight(result)"
            />
          </a>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tb-search-enter-active,
.tb-search-leave-active {
  transition: opacity 0.25s ease;
}
.tb-search-enter-from,
.tb-search-leave-to {
  opacity: 0;
}
</style>
