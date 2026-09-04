import { initGems } from './gems'
import { typeSequence, cursorTrail, consoleArt } from './effects'
import { installConsoleApi } from './console-api'

export function initEasterEggs() {
  installConsoleApi()

  if ((window as any).__tbEasterEggsReady) {
    initGems()
    return
  }
  ;(window as any).__tbEasterEggsReady = true

  function init() {
    consoleArt()
    typeSequence()
    cursorTrail()
    initGems()
  }

  document.addEventListener('astro:after-swap', initGems)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
}
