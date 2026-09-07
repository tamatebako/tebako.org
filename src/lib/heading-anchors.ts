export function installHeadingAnchors() {
  const style = document.createElement('style')
  style.textContent = `
    .tb-prose h2, .tb-prose h3 { position: relative; }
    .tb-anchor {
      position: absolute;
      left: -1.25rem;
      top: 0;
      width: 1.1rem;
      text-decoration: none;
      color: var(--tb-c-text-3, #888);
      opacity: 0;
      transition: opacity 0.2s;
    }
    .tb-prose h2:hover .tb-anchor,
    .tb-prose h3:hover .tb-anchor,
    .tb-anchor:focus-visible { opacity: 1; }
    .tb-anchor::after { content: '#'; font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.75em; }
    @media (max-width: 1024px) { .tb-anchor { display: none; } }
  `
  document.head.appendChild(style)

  document.querySelectorAll<HTMLElement>('.tb-prose h2[id], .tb-prose h3[id]').forEach((h) => {
    if (h.querySelector('.tb-anchor')) return
    const a = document.createElement('a')
    a.className = 'tb-anchor'
    a.href = `#${h.id}`
    a.setAttribute('aria-label', `Link to this section: ${h.textContent?.trim() ?? ''}`)
    h.appendChild(a)
  })
}
