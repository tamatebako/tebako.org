# tebako.org — Claude Code Guide

The tebako.org website: Astro 7 (static), Tailwind CSS 4, Vue islands for interactive chrome, AsciiDoc for all content.

## Architecture

Every docs page and blog post is an **AsciiDoc collection entry** (`.adoc` file), rendered through one of three dynamic `[slug]` routes. No docs page is hand-written template code.

```
content                          rendering                    gates (CI)
_docs/architecture/  25 .adoc →  [slug].astro (thin wrapper) → astro check
_docs/guides/        15 .adoc →  [slug].astro (thin wrapper) → vitest (30 tests)
_docs/reference/      9 .adoc →  [slug].astro (thin wrapper) → build
_posts/              35 .adoc →  blog/[slug].astro           → link checker
```

Three deep modules hold the system:

- **`src/config/docs.ts`** — the docs registry: sections, order, labels, hrefs, shipped/planned status. Navigation, breadcrumbs, numbering, and prev/next derive from it. `tests/docs-registry.test.ts` asserts its invariants against the filesystem.
- **`src/config/series.ts`** — the blog series registry. Posts declare membership in frontmatter (`series` + `series_post`); the adoc loader renders the series box at build time. `tests/series.test.ts` pins registry to posts.
- **`src/content/loaders/adoc-loader.ts`** — converts .adoc to HTML: frontmatter extraction, series-block injection, Asciidoctor conversion. `tests/adoc-loader.test.ts` covers 14 unit tests including the `__tpkg__` emphasis trap.

## Writing rules (enforced by CI)

`tests/prose-lint.test.ts` sweeps all content for banned vocabulary and structural violations. The rules:

- **Complete sentences** — no fragments, no staccato ("No Homebrew. No apt.")
- **No smart-ass phrasing** — no "rides the bus", no "three-layer telescope", no "not a vibe"
- **Artifact + action** — "The following command on X outputs Y", not "What a real compile looks like, from the acceptance runs"
- **No dates or provenance meta** — no "from our acceptance runs on 30 August"
- **No internal references** — no spec numbers, no PROGRESS files, no `// source:` comments in visible prose
- **User-relevant only** — describe the system to users, never the project to itself

Scoped exemptions: pre-2026 posts (frozen history), the 404 page's nautical theme, spec citations in docs pages (established provenance style).

## Adding content

**A docs page** (any section):
1. Create `_docs/<section>/<slug>.adoc` with frontmatter: `title`, `description`, optional `heading` and `lede`
2. Add one entry to the matching section in `src/config/docs.ts`
3. `npm test` fails if the entry and the file disagree

**A blog post**:
1. Create `_posts/<date>-<slug>.adoc` with frontmatter: `title`, `date`, `categories`, `author`, `excerpt`
2. For a series post: add `series: <series-id>` and `series_post: <n>`
3. Series boxes are rendered automatically from `src/config/series.ts`

## Known AsciiDoc traps

- `__tpkg__` in inline prose corrupts to `<em>tpkg</em>` (Asciidoctor emphasis pairing). Fix: wrap in `+…+` unconstrained span. Inside code blocks, it renders correctly.
- `|` inside a table cell silently drops the row. Escape as `\|`.
- `image::` macro splits alt text on commas. Use `++++` passthrough `<figure>` for diagrams.
- YAML frontmatter values containing `: ` must use folded `>-` style.

## CSS traps

- The header bar has `backdrop-filter`, which makes it the **containing block for fixed-position descendants**. Any fullscreen overlay rendered inside the header must be `<Teleport to="body">` — but guarded by an `isClient` flag (Astro SSRs islands in isolation; hydrating an unguarded Teleport makes Vue delete the `<header>`).

## Commands

```
npm run dev        # http://localhost:4321
npm run build      # dist/ + Pagefind index
npm run check      # astro check (types/templates)
npm test           # vitest (30 tests)
npm run preview    # serve the production build
```

Clear the Astro content cache when debugging loader changes: `rm -rf node_modules/.astro`.
