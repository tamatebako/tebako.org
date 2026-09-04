import { GEM_KEY, WISDOM_KEY } from './storage'

declare global {
  interface Window {
    help?: () => string
    tebako?: {
      help: () => string
      gems: () => number
      total: () => number
      wisdom: () => number
      reset: () => string
    }
  }
}

function readCount(key: string): number {
  try { return JSON.parse(localStorage.getItem(key) || '[]').length }
  catch { return 0 }
}

export function installConsoleApi() {
  window.help = function () {
    const found = readCount(GEM_KEY)
    const wisdom = readCount(WISDOM_KEY)
    return [
      '🎁 Tebako Easter Eggs',
      '',
      '1. Click the jewel box on the homepage — the Ruby flies out',
      '2. Type "tebako" anywhere — tumbling gem shower',
      '3. Find 8 hidden collector gems (◆) across the site',
      '4. Click wisdom gems for quotes that fly away',
      '5. Leave the homepage idle 30s — the box glows',
      '6. Visit a nonexistent URL — drift lost at sea',
      '7. Move your cursor — gold sparkles trail',
      '',
      'Progress: ' + found + '/8 gems collected · ' + wisdom + ' wisdom gems',
      '',
      'Tips: gems are faint — look in corners, near headings, in the footer.',
      'Type tebako.help(), tebako.gems(), tebako.reset()',
    ].join('\n')
  }
  window.tebako = {
    help: function () { return window.help!() },
    gems: function () { return readCount(GEM_KEY) + readCount(WISDOM_KEY) },
    total: function () { return 19 },
    wisdom: function () { return readCount(WISDOM_KEY) },
    reset: function () {
      localStorage.removeItem(GEM_KEY)
      localStorage.removeItem(WISDOM_KEY)
      return '✨ All progress reset. Reload to start fresh.'
    },
  }
}
