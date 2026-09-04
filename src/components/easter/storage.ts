export const ALL_GEMS = [
  'hero-crown', 'kanji-tama', 'kanji-te', 'kanji-bako',
  'terminal-gem', 'blog-compass', 'footer-treasure', 'sea-404',
]

export const GEM_KEY = 'tb-gems-found'
export const WISDOM_KEY = 'tb-wisdom-found'

export const MESSAGES: Record<number, string> = {
  1: 'A gem glimmers in the light. 1/8',
  2: 'Two gems now. The box stirs. 2/8',
  3: 'Three gathered. 3/8',
  4: 'Halfway. The Ruby brightens. 4/8',
  5: 'Five gems. A collector\'s eye. 5/8',
  6: 'Six. The ocean whispers. 6/8',
  7: 'Seven gems. One remains. 7/8',
  8: 'All gems found. The tamatebako is complete. ✨',
}

export function getFound(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(GEM_KEY) || '[]')) }
  catch { return new Set() }
}

export function saveFound(found: Set<string>) {
  try { localStorage.setItem(GEM_KEY, JSON.stringify([...found])) }
  catch { /* localStorage unavailable */ }
}

export function getWisdomFound(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(WISDOM_KEY) || '[]')) }
  catch { return new Set() }
}

export function saveWisdomFound(found: Set<string>) {
  try { localStorage.setItem(WISDOM_KEY, JSON.stringify([...found])) }
  catch { /* localStorage unavailable */ }
}
