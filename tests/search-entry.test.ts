import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// The search island loads Pagefind through a bare dynamic import at runtime —
// a typo here 404s silently and search degrades to "index could not be
// loaded" on every page (it did, for the whole first deployment: the import
// named pagefind-entry.js, which Pagefind has never emitted as JS). This test
// pins the contract: the path the island imports must be a file Pagefind
// actually writes, in dist when a build is present, and by name otherwise.
const EMITTED_ENTRY = '/pagefind/pagefind.js'

describe('search entry contract', () => {
  it('the island imports a Pagefind-emitted entry', () => {
    const src = readFileSync(resolve(__dirname, '../src/components/SearchButton.vue'), 'utf-8')
    const imports = [...src.matchAll(/import\([^)]*['"]\/pagefind\/[^'"]+['"]/g)].map(
      (m) => m[0].match(/['"](\/pagefind\/[^'"]+)['"]/)![1],
    )
    expect(imports.length, 'the island must dynamically import the pagefind bundle').toBeGreaterThan(0)
    expect(imports).toEqual([EMITTED_ENTRY])
  })

  it('the emitted entry exists in a built site', () => {
    const built = resolve(__dirname, '../dist' + EMITTED_ENTRY)
    if (!existsSync(resolve(__dirname, '../dist/pagefind'))) return // pre-build test job: skipped
    expect(existsSync(built), `dist${EMITTED_ENTRY} must exist after pagefind runs`).toBe(true)
  })
})
