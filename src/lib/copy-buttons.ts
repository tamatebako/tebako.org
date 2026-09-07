export function installCopyButtons() {
  const style = document.createElement('style')
  style.textContent = `
    .tb-copy-wrap { position: relative; }
    .tb-copy-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      padding: 0.25rem 0.625rem;
      border-radius: 0.5rem;
      border: 1px solid var(--tb-c-divider, rgba(128,128,128,.3));
      background: var(--tb-c-bg-soft, #f5f5f5);
      color: var(--tb-c-text-3, #888);
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 0.7rem;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .tb-copy-wrap:hover .tb-copy-btn { opacity: 1; }
    .tb-copy-btn:hover { border-color: var(--tb-c-accent); color: var(--tb-c-accent); }
    .tb-copy-btn.copied { color: var(--tb-c-accent); border-color: var(--tb-c-accent); }
  `
  document.head.appendChild(style)

  document.querySelectorAll('.tb-prose pre, .tb-prose .listingblock pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('tb-copy-wrap')) return
    const wrap = document.createElement('div')
    wrap.className = 'tb-copy-wrap'
    pre.parentElement!.insertBefore(wrap, pre)
    wrap.appendChild(pre)

    const btn = document.createElement('button')
    btn.className = 'tb-copy-btn'
    btn.type = 'button'
    btn.textContent = 'copy'
    btn.setAttribute('aria-label', 'Copy code to clipboard')
    btn.addEventListener('click', async () => {
      const text = pre.textContent || ''
      try {
        await navigator.clipboard.writeText(text)
        btn.textContent = 'copied'
        btn.classList.add('copied')
        setTimeout(() => {
          btn.textContent = 'copy'
          btn.classList.remove('copied')
        }, 2000)
      } catch {
        btn.textContent = 'error'
        setTimeout(() => { btn.textContent = 'copy' }, 2000)
      }
    })
    wrap.appendChild(btn)
  })
}
