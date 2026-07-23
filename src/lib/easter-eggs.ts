export const ALL_GEMS = [
  'hero-crown',
  'kanji-tama',
  'kanji-te',
  'kanji-bako',
  'terminal-gem',
  'blog-compass',
  'footer-treasure',
  'sea-404',
] as const

export type GemId = (typeof ALL_GEMS)[number]

export const GEM_MESSAGES: Record<number, string> = {
  1: 'A gem glimmers in the light. 1/8',
  2: 'Two gems now. The box stirs. 2/8',
  3: 'Three gems gathered. 3/8',
  4: 'Halfway there. The Ruby brightens. 4/8',
  5: 'Five gems. You have a collector\'s eye. 5/8',
  6: 'Six. The ocean whispers your name. 6/8',
  7: 'Seven gems. One remains hidden. 7/8',
  8: 'All gems found. The tamatebako is complete. ✨',
}

export const GEM_STORAGE_KEY = 'tb-gems-found'
