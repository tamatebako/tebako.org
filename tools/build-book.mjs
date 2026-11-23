// build-book.mjs — build the Tebako Volume (book/).
//
// The volume renders the normative spec set plus the composition calculus
// as one citable document: the spec chapters are the AsciiDoc twins of
// docs/spec/*.md in tamatebako/tebako (docs/spec-site/sources/, regenerated
// by that repo's own sync discipline — consumed here READ-ONLY, never
// edited), the architecture chapter is this site's own
// _docs/architecture/composition-calculus.adoc, and the entry point is the
// authored book/book.adoc. The toolchain is the packed metanorma payload,
// pinned in book/book.yaml — never a floating "latest".
//
// What the build does, in order:
//
//   1. reads book/book.yaml and the include lines of book/book.adoc (the
//      authored chapter list and reading order);
//   2. resolves the spec source ref (default book.yaml's ref,
//      BOOK_SPEC_REF overrides) to an exact commit sha via git ls-remote;
//   3. fetches each spec twin from raw.githubusercontent.com at that sha,
//      verifies its `// source:` marker (the sync discipline's provenance)
//      and its :docnumber: against the chapter heading, strips the
//      standalone-document header, and writes the chapter body;
//   4. transforms the architecture chapter (frontmatter strip; every body
//      section marked unnumbered — the volume's numbering apparatus is the
//      chapter headings, and the site's own rendering never numbers);
//   5. stamps build/stamp.adoc (:published-date:) and build/colophon.adoc
//      (the build's provenance: source revisions, per-chapter source
//      markers, toolchain identity);
//   6. pre-stages the ribose flavor's fonts — the families fontist
//      resolves by name through the payload's own fontist dispatch, plus
//      the google families dropped byte-exact from pinned URLs (see
//      prestageFonts for why the by-name path cannot serve them) — then
//      removes every index file (the fontist/fontist#554 workaround the
//      packed-mn release gate documents), so the compile re-globs a
//      complete font tree instead of racing the download-at-compile
//      path or adopting a partial burst index;
//   7. compiles book/book.adoc with the pinned metanorma in two passes
//      (TEBAKO_METANORMA_VERSION pins the shim dispatch): first
//      -x xml,html,rxl, then -x xml,pdf. The single four-output compile
//      kills the mn2pdf java leg silently when a worker thread of a
//      large document spawns it — the depended-runtime spawn never
//      reaches the temurin runtime (observed: empty stdout/stderr,
//      nonzero exit, reproducible on the full volume, absent on a small
//      one); the sequential two-pass shape never trips it;
//   8. collects the outputs into book/dist/ as index.html (the single-page
//      volume) and tebako-volume.pdf, verifies them (non-empty, PDF
//      magic), and writes dist/build-manifest.json.
//
// Fails closed: a malformed twin, a docnumber drift, a missing marker, a
// failed compile — all named errors, never a quietly partial volume.
//
// Usage:
//   node tools/build-book.mjs            # full build
//   node tools/build-book.mjs --offline  # reuse the build/ snapshot
//                                        # (iterate without refetching)
// Env:
//   BOOK_SPEC_REF      spec source ref override (default book.yaml's ref)
//   BOOK_SPEC_BASE     fetch base override (tests, mirrors; file:// ok —
//                      expects <base>/<file> per chapter)
//   BOOK_METANORMA     metanorma command (default "metanorma" — the shim
//                      dispatch, or a packed-mn binary path)
//   TEBAKO_METANORMA_VERSION  honored by the shim layer; the build sets it
//                      from book.yaml's pin when invoking metanorma/fontist

import {
  readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync,
  existsSync, statSync, readdirSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import YAML from 'yaml'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOOK_DIR = join(ROOT, 'book')
const BUILD_DIR = join(BOOK_DIR, 'build')
const DIST_DIR = join(BOOK_DIR, 'dist')
const OUT_DIR = join(BUILD_DIR, 'out')
const CONFIG_FILE = join(BOOK_DIR, 'book.yaml')
const ENTRY_FILE = join(BOOK_DIR, 'book.adoc')
const SNAPSHOT_FILE = join(BUILD_DIR, 'snapshot.json')

const MARKER = /\/\/ source: (\S+) @ ([0-9a-f]{40})/
const INCLUDE =
  /^include::build\/bodies\/(spec|arch)\/([A-Za-z0-9._-]+\.adoc)\[leveloffset=\+1\]\s*$/

class BookError extends Error {}

const fail = (message) => {
  throw new BookError(message)
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

const offline = process.argv.includes('--offline')

function loadConfig() {
  let doc
  try {
    doc = YAML.parse(readFileSync(CONFIG_FILE, 'utf8'))
  } catch (err) {
    fail(`config-unreadable: ${CONFIG_FILE}: ${err.message}`)
  }
  const spec = doc?.spec_sources
  const toolchain = doc?.toolchain
  if (!spec?.repo || !spec?.ref || !spec?.path || !spec?.architecture_dir) {
    fail('config-malformed: book.yaml needs spec_sources.{repo,ref,path,architecture_dir}')
  }
  if (!toolchain?.registry_version || !toolchain?.packed_tag) {
    fail('config-malformed: book.yaml needs toolchain.{registry_version,packed_tag}')
  }
  if (!doc?.volume?.docnumber || !doc?.volume?.title) {
    fail('config-malformed: book.yaml needs volume.{title,docnumber}')
  }
  return doc
}

// The authored chapter list: the entry point's include lines, in order,
// each preceded by its [%unnumbered] chapter heading (== Title).
function parseEntry() {
  const lines = readFileSync(ENTRY_FILE, 'utf8').split('\n')
  const chapters = []
  let heading = null
  for (const line of lines) {
    const h = line.match(/^== (.+)$/)
    if (h) heading = h[1].trim()
    const m = line.match(INCLUDE)
    if (m) {
      if (!heading) fail(`entry-malformed: include for ${m[2]} has no chapter heading`)
      chapters.push({ kind: m[1], file: m[2], heading })
      heading = null
    }
  }
  if (chapters.length === 0) fail('entry-malformed: no chapter includes found in book.adoc')
  return chapters
}

function resolveRef(repo, ref) {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref
  const url = `https://github.com/${repo}.git`
  for (const pattern of [`refs/heads/${ref}`, `refs/tags/${ref}`, ref]) {
    let out
    try {
      out = execFileSync('git', ['ls-remote', url, pattern], { encoding: 'utf8' })
    } catch (err) {
      fail(`spec-ref-unresolvable: git ls-remote ${url} ${pattern}: ${err.message}`)
    }
    const line = out.split('\n').find((l) => /^[0-9a-f]{40}\t/.test(l))
    if (line) return line.split('\t')[0]
  }
  fail(`spec-ref-unresolvable: ${repo} has no ref ${ref}`)
}

async function fetchText(url) {
  if (url.startsWith('file://')) {
    try {
      return readFileSync(fileURLToPath(url), 'utf8')
    } catch (err) {
      fail(`source-unreachable: ${url}: ${err.message}`)
    }
  }
  let res
  try {
    res = await fetch(url, { headers: { 'user-agent': 'tebako-org-book' } })
  } catch (err) {
    fail(`source-unreachable: ${url}: ${err.message}`)
  }
  if (!res.ok) fail(`source-unreachable: ${url}: HTTP ${res.status}`)
  return res.text()
}

// A spec twin is a standalone metanorma document: `= Title`, attribute
// lines, the sync discipline's `// source:` marker, a blank line, then the
// body. The volume consumes the body verbatim; the header's identity
// fields are validated against the volume's own chapter apparatus.
function transformSpecTwin(file, text, heading) {
  const lines = text.split('\n')
  const titleLine = lines[0]?.match(/^= (.+)$/)
  if (!titleLine) fail(`twin-malformed: ${file} does not start with a document title`)
  const blank = lines.findIndex((l, i) => i > 0 && l.trim() === '')
  if (blank === -1) fail(`twin-malformed: ${file} has no header/body split`)
  const header = lines.slice(0, blank).join('\n')
  const body = lines.slice(blank + 1).join('\n')
  const marker = text.match(MARKER)
  const docnumber = header.match(/^:docnumber: (.+)$/m)?.[1]?.trim() ?? null
  const identity = heading.match(/^(TBK SPEC \d+) — /)?.[1] ?? null
  if (!identity) fail(`entry-malformed: chapter heading "${heading}" carries no TBK SPEC identity`)
  // The series landing is the one document without a `// source:` marker:
  // it renders no Markdown file, so the sync discipline does not gate it
  // (its sync.rb says so in as many words).
  if (!marker && identity !== 'TBK SPEC 00') {
    fail(`twin-missing-marker: ${file} records no \`// source:\` line — the sync discipline's provenance is required`)
  }
  if (docnumber && docnumber !== identity) {
    fail(`docnumber-drift: chapter heading says ${identity} but ${file} declares :docnumber: ${docnumber}`)
  }
  if (!docnumber && identity !== 'TBK SPEC 00') {
    fail(`docnumber-drift: ${file} declares no :docnumber: but the chapter heading says ${identity}`)
  }
  return {
    title: titleLine[1].trim(),
    body,
    sourcePath: marker ? marker[1] : `${file} (the series landing — no Markdown source)`,
    sourceSha: marker ? marker[2] : null,
    docnumber,
  }
}

// An architecture chapter is a site content page: YAML frontmatter, then
// the adoc body. The volume consumes the body; every body section is
// marked unnumbered because the volume's numbering apparatus is the
// chapter headings (the site's own rendering never numbers).
function transformArchChapter(file, text, heading) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) fail(`arch-malformed: ${file} has no frontmatter`)
  let fm
  try {
    fm = YAML.parse(m[1])
  } catch (err) {
    fail(`arch-malformed: ${file} frontmatter does not parse: ${err.message}`)
  }
  if (!fm?.title) fail(`arch-malformed: ${file} frontmatter has no title`)
  if (fm.title !== heading) {
    fail(`arch-title-drift: chapter heading "${heading}" != ${file} title "${fm.title}"`)
  }
  const body = m[2]
    .split('\n')
    .map((l) => l)
    .join('\n')
  const marked = body.replace(/^(?===+ )/gm, '[%unnumbered]\n')
  return { title: fm.title, body: marked }
}

// The font pre-stage runs two tracks, then wipes the indexes:
//
//   install — families the payload's own fontist dispatch resolves by
//      name (STIX Two Math via the `stix` formula; Source Serif Pro and
//      Source Code Pro via the `source` formula). A failed install is not
//      fatal: the compile resolves fonts itself and its own failure is
//      the gate.
//   statics — the three google families (Open Sans, Source Sans 3, Noto
//      Sans Mono) dropped byte-exact into ~/.fontist/fonts/tebako-book/
//      from pinned URLs with pinned sha256. fontist 3.0.11's by-name
//      resolution always selects the variable resource, whose name table
//      registers only the base family — the weight-named families the
//      ribose manifest declares (Open Sans Light, Open Sans Semibold,
//      Noto Sans Mono Light) then never resolve, and the whole-formula
//      alternative dies upstream on a sha-pinned moving archive. Static
//      instances register their real families in the rebuilt index and
//      give the PDF leg real weights instead of a variable font's
//      default instance. A fetch or checksum failure here IS fatal:
//      these files are the only route to those families.
//   wipe — every ~/.fontist/*index*.yml is removed afterwards, so the
//      compile re-globs the complete font tree instead of adopting a
//      partial burst index (the fontist/fontist#554 race the packed-mn
//      release gate documents).
async function prestageFonts(fonts, env) {
  if (!fonts) return { note: 'no fonts configured' }
  try {
    execFileSync('fontist', ['--help'], { stdio: 'ignore', env })
  } catch {
    return { note: 'fontist not on PATH — skipping pre-stage (the compile resolves fonts itself)' }
  }
  const installed = []
  const skipped = []
  for (const name of fonts.install ?? []) {
    try {
      execFileSync('fontist', ['install', name, '--confirm-license'], { stdio: 'inherit', env })
      installed.push(name)
    } catch {
      skipped.push(name)
    }
  }
  const fontistHome = join(homedir(), '.fontist')
  const statics = fonts.statics ?? []
  const result = { installed, skipped, statics: { fetched: 0, cached: 0 }, note: null }
  if (statics.length) {
    const staticsDir = join(fontistHome, 'fonts', 'tebako-book')
    mkdirSync(staticsDir, { recursive: true })
    for (const entry of statics) {
      if (!entry?.url || !entry?.sha256) {
        fail('config-malformed: book.yaml fonts.statics entries need {url, sha256}')
      }
      const name = basename(new URL(entry.url).pathname)
      const dest = join(staticsDir, name)
      if (existsSync(dest) && sha256(readFileSync(dest)) === entry.sha256) {
        result.statics.cached++
        continue
      }
      let res
      try {
        res = await fetch(entry.url, { headers: { 'user-agent': 'tebako-org-book' } })
      } catch (err) {
        fail(`font-static-unreachable: ${entry.url}: ${err.message}`)
      }
      if (!res.ok) fail(`font-static-unreachable: ${entry.url}: HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const got = sha256(buf)
      if (got !== entry.sha256) {
        fail(`font-static-checksum: ${name}: expected ${entry.sha256}, got ${got}`)
      }
      writeFileSync(dest, buf)
      result.statics.fetched++
    }
  }
  if (existsSync(fontistHome)) {
    for (const f of readdirSync(fontistHome)) {
      if (/index.*\.yml$/.test(f)) rmSync(join(fontistHome, f))
    }
  }
  return result
}

function gitHead() {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: ROOT }).trim()
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: ROOT }).trim() !== ''
    return { sha, dirty }
  } catch {
    return { sha: null, dirty: null }
  }
}

function colophon(config, snapshot, chapters, dateUtc) {
  const spec = config.spec_sources
  const tc = config.toolchain
  const site = gitHead()
  const rows = chapters
    .map((c) => {
      const src = c.kind === 'spec'
        ? `\`tamatebako/tebako:${c.record.sourcePath}\``
        : `\`tamatebako/tebako.org:${spec.architecture_dir}/${c.file}\``
      const sha = c.kind === 'spec' && c.record.sourceSha ? `\`${c.record.sourceSha}\`` : '—'
      return `|${c.identity} |${src} |${sha}`
    })
    .join('\n')
  return `// GENERATED by tools/build-book.mjs — regenerated every build; never edited by hand.

This volume was assembled and rendered by the ecosystem's own toolchain.
Nothing in it is hand-copied: every chapter is transformed mechanically
from the source recorded below, and the build fails closed on any drift it
can name.

[cols="1,4",options="header"]
|===
|Layer |Provenance

|Spec chapters
|the AsciiDoc twins at \`docs/spec-site/sources/\` in \`tamatebako/tebako\`, commit \`${snapshot.sha}\` (\`${spec.ref}\` at build time). Each twin is the rendered form of the Markdown specification its \`// source:\` marker names; the build verified every marker.

|Architecture chapters
|\`${spec.architecture_dir}/\` in \`tamatebako/tebako.org\`${site.sha ? `, commit \`${site.sha}\`${site.dirty ? ' (working tree dirty)' : ''}` : ''}

|Toolchain
|the packed metanorma payload, version ${tc.registry_version} (\`tebako install metanorma@${tc.registry_version}\` from the official registry, \`tfs:github:tebako-packages/registry\`), dispatched through the tebako shim layer. Build command: \`npm run book\`.

|Build date
|${dateUtc} (UTC)
|===

[cols="1,3,2",options="header"]
|===
|Chapter |Source |Source blob SHA

${rows}
|===

The artifact checksums of this build (the single-page HTML and the PDF)
are recorded in \`build-manifest.json\` alongside the artifacts.
`
}

// FOP writes its page objects inside FlateDecode-compressed object
// streams (/ObjStm), so a bare regex over the file sees none. Count in
// the raw text and in every inflated stream.
function pdfPages(buf) {
  const s = buf.toString('latin1')
  let pages = (s.match(/\/Type\s*\/Page[^s]/g) || []).length
  const re = /stream\r?\n/g
  let m
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length
    const end = s.indexOf('endstream', start)
    if (end === -1) continue
    let raw = buf.subarray(start, end)
    while (raw.length && (raw[raw.length - 1] === 0x0a || raw[raw.length - 1] === 0x0d)) {
      raw = raw.subarray(0, raw.length - 1)
    }
    try {
      const out = zlib.inflateSync(raw).toString('latin1')
      pages += (out.match(/\/Type\s*\/Page[^s]/g) || []).length
    } catch { /* not a flate stream */ }
  }
  return pages
}

async function main() {
  const config = loadConfig()
  const chapters = parseEntry()
  mkdirSync(join(BUILD_DIR, 'bodies', 'spec'), { recursive: true })
  mkdirSync(join(BUILD_DIR, 'bodies', 'arch'), { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(DIST_DIR, { recursive: true })

  const spec = config.spec_sources
  const ref = process.env.BOOK_SPEC_REF || spec.ref
  const base = process.env.BOOK_SPEC_BASE
  let snapshot

  if (offline) {
    if (!existsSync(SNAPSHOT_FILE)) fail('offline-missing-snapshot: build/snapshot.json not found — run a full build first')
    snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'))
  } else {
    const sha = base ? null : resolveRef(spec.repo, ref)
    snapshot = { repo: spec.repo, ref, sha, path: spec.path, fetchedAt: new Date().toISOString() }
  }

  for (const chapter of chapters) {
    if (!offline) {
      if (chapter.kind === 'spec') {
        const url = base
          ? `${base.replace(/\/$/, '')}/${chapter.file}`
          : `https://raw.githubusercontent.com/${spec.repo}/${snapshot.sha}/${spec.path}/${chapter.file}`
        const text = await fetchText(url)
        chapter.record = transformSpecTwin(chapter.file, text, chapter.heading)
      } else {
        const p = join(ROOT, spec.architecture_dir, chapter.file)
        if (!existsSync(p)) fail(`arch-missing: ${p}`)
        chapter.record = transformArchChapter(chapter.file, readFileSync(p, 'utf8'), chapter.heading)
      }
      writeFileSync(join(BUILD_DIR, 'bodies', chapter.kind, chapter.file), chapter.record.body)
    } else {
      const saved = snapshot.chapters?.find(
        (c) => c.kind === chapter.kind && c.file === chapter.file && c.heading === chapter.heading,
      )
      if (!saved) {
        fail(`offline-snapshot-drift: ${chapter.kind}/${chapter.file} is not in build/snapshot.json — the entry point changed; run a full build`)
      }
      chapter.record = saved.record
    }
    chapter.identity = chapter.kind === 'spec'
      ? chapter.heading.match(/^(TBK SPEC \d+)/)[1]
      : chapter.heading
  }
  if (!offline) {
    snapshot.chapters = chapters.map((c) => ({
      kind: c.kind, file: c.file, heading: c.heading, record: c.record,
    }))
    writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2))
  }

  const dateUtc = new Date().toISOString().slice(0, 10)
  writeFileSync(join(BUILD_DIR, 'stamp.adoc'), `:published-date: ${dateUtc}\n`)
  writeFileSync(join(BUILD_DIR, 'colophon.adoc'), colophon(config, snapshot, chapters, dateUtc))

  const tc = config.toolchain
  const metanorma = process.env.BOOK_METANORMA || 'metanorma'
  const env = { ...process.env, TEBAKO_METANORMA_VERSION: tc.registry_version }

  const fonts = await prestageFonts(config.fonts, env)
  if (fonts.note) console.log(`book: ${fonts.note}`)
  if (fonts.installed?.length) console.log(`book: fontist-installed: ${fonts.installed.join(', ')}`)
  if (fonts.skipped?.length) console.log(`book: WARNING font install skipped: ${fonts.skipped.join(', ')} (the compile resolves fonts itself)`)
  if (fonts.statics) console.log(`book: static fonts: ${fonts.statics.fetched} fetched, ${fonts.statics.cached} cached`)

  console.log(`book: compiling ${chapters.length} chapters with ${metanorma} (pin ${tc.registry_version})`)
  // Two sequential passes: the single four-output compile (xml,html,pdf,rxl
  // on the worker pool) kills the mn2pdf java leg silently on a large
  // document — the spawned depended runtime never boots (empty
  // stdout/stderr, nonzero exit; reproducible). Split so the java leg
  // never shares the pool with the other outputs.
  const passes = ['xml,html,rxl', 'xml,pdf']
  for (const extensions of passes) {
    try {
      execFileSync(metanorma, ['compile', '--agree-to-terms', '-x', extensions, '-o', OUT_DIR, 'book.adoc'], {
        cwd: BOOK_DIR,
        stdio: 'inherit',
        env,
      })
    } catch (err) {
      fail(`compile-failed: ${metanorma} compile -x ${extensions} exited ${err.status ?? err.message}`)
    }
  }

  const findOutput = (name) =>
    [join(OUT_DIR, name), join(BOOK_DIR, name)].find((p) => existsSync(p) && statSync(p).size > 0)
  const htmlOut = findOutput('book.html')
  const pdfOut = findOutput('book.pdf')
  if (!htmlOut) fail('artifact-missing: the compile produced no book.html')
  if (!pdfOut) fail('artifact-missing: the compile produced no book.pdf')

  const htmlBuf = readFileSync(htmlOut)
  const pdfBuf = readFileSync(pdfOut)
  if (!pdfBuf.subarray(0, 5).equals(Buffer.from('%PDF-'))) fail('artifact-malformed: book.pdf lacks the PDF magic')

  const pages = pdfPages(pdfBuf)
  copyFileSync(htmlOut, join(DIST_DIR, 'index.html'))
  copyFileSync(pdfOut, join(DIST_DIR, 'tebako-volume.pdf'))

  const manifest = {
    volume: config.volume,
    snapshot,
    toolchain: {
      metanorma: tc.registry_version,
      packed_tag: tc.packed_tag,
      command: metanorma,
    },
    artifacts: {
      'index.html': { bytes: htmlBuf.length, sha256: sha256(htmlBuf) },
      'tebako-volume.pdf': { bytes: pdfBuf.length, sha256: sha256(pdfBuf), pages },
    },
    chapters: chapters.map((c) => ({
      kind: c.kind,
      file: c.file,
      heading: c.heading,
      source: c.kind === 'spec' ? c.record?.sourcePath : `${spec.architecture_dir}/${c.file}`,
      source_blob_sha: c.kind === 'spec' ? c.record?.sourceSha : undefined,
    })),
    builtAt: new Date().toISOString(),
  }
  writeFileSync(join(DIST_DIR, 'build-manifest.json'), JSON.stringify(manifest, null, 2))

  console.log(`book: dist/index.html ${htmlBuf.length} bytes`)
  console.log(`book: dist/tebako-volume.pdf ${pdfBuf.length} bytes, ${pages} pages`)
  console.log(`book: ${chapters.length} chapters, spec sources ${snapshot.repo}@${snapshot.sha ?? snapshot.ref}`)
}

main().catch((err) => {
  console.error(`book: ${err.message}`)
  process.exit(1)
})
