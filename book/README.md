# The Tebako Volume

The specification set and the composition calculus, rendered as **one
citable volume** and built by the ecosystem's own toolchain — the packed
metanorma payload, installed from the official tebako registry and
dispatched through the shim layer. The build runs on every docs publish of
tebako.org; the site serves the single-page HTML at `/book/` and the PDF
at `/book/tebako-volume.pdf`.

## What is here

- `book.adoc` — the entry point: the volume's metadata, the preface, and
  the authored chapter list in reading order. Chapters are includes of
  generated bodies (`build/bodies/…`), each consumed **read-only** from
  its source.
- `book.yaml` — the build configuration: volume metadata, where the spec
  chapters come from, the toolchain pins, and the font set the ribose
  flavor's PDF leg needs.
- `metanorma.yml` — the metanorma configuration of the volume (source +
  collection identity). After `npm run book` has generated `build/`, a
  bare `metanorma site generate book/` renders the same entry point.
- `build/` — generated per build (never committed): the chapter bodies,
  the stamp, the colophon, the fetched-source snapshot, and the compile
  outputs.
- `dist/` — generated per build (never committed): the shipped artifacts —
  `index.html` (the single-page volume), `tebako-volume.pdf`, and
  `build-manifest.json` (artifact checksums, page count, per-chapter
  provenance).

## The chapters, and why this build can trust them

The spec chapters are the AsciiDoc twins of the normative Markdown
specifications. Their home is `docs/spec-site/sources/` in
[tamatebako/tebako](https://github.com/tamatebako/tebako); they regenerate
from `docs/spec/*.md` under that repository's own sync discipline
(`docs/spec-site/tools/sync.rb` is the drift gate — a spec edit without a
re-synced twin reds that gate). This build fetches the twins at an exact
commit and verifies every `// source:` marker they carry, but it never
edits them: a stale twin is the sync gate's red, not this build's.

The architecture chapter is this site's own
`_docs/architecture/composition-calculus.adoc` — the draft paper that
states the model the specifications normatively define.

## Building (the reproducible path)

Prerequisites: a checkout of this repository, Node 22, and the tebako CLI
(`2.8.x`).

```console
$ npm ci
$ tebako add-registry tfs:github:tebako-packages/registry --name official   # once per store
$ tebako install metanorma@1.18.6        # the pin — book/book.yaml, toolchain.registry_version
$ export PATH="$HOME/.tebako/shims:$PATH"
$ npm run book
```

`npm run book` fetches the spec twins (resolving the configured ref —
`main` — to an exact commit via `git ls-remote`, then fetching at that
commit), assembles the chapter bodies, stamps the date and the colophon,
pre-stages the declared fonts (by-name fontist installs plus pinned
static drops — see `book.yaml`'s fonts comment for why both tracks
exist), and compiles `book/book.adoc` to `build/out/`. The artifacts
land in `book/dist/`; the last log lines give the byte counts and the
PDF page count.

Pins, never latest: the metanorma payload is `1.18.6` and the packed-mn
release alternative is `v1.18.6-3`, both in `book.yaml`. The shim dispatch
is pinned per invocation via `TEBAKO_METANORMA_VERSION`, which the build
sets from the same file.

### The packed-release alternative

The same upstream metanorma also ships as the single-file packed release
(`metanorma/packed-mn`); `BOOK_METANORMA` selects the command:

```console
$ curl -sSfLO https://github.com/metanorma/packed-mn/releases/download/v1.18.6-3/metanorma-linux-x86_64.tgz
$ curl -sSfLO https://github.com/metanorma/packed-mn/releases/download/v1.18.6-3/metanorma-linux-x86_64.tgz.sha256.txt
$ echo "$(awk '{print $1}' metanorma-linux-x86_64.tgz.sha256.txt)  metanorma-linux-x86_64.tgz" | sha256sum -c -
$ tar xzf metanorma-linux-x86_64.tgz
$ BOOK_METANORMA="$PWD/metanorma-linux-x86_64" npm run book
```

The registry path is what CI uses (see `.github/workflows/build_deploy.yml`)
and what this volume's own preface means by "the ecosystem's own
toolchain": install, dispatch, mount, and spawn all ride the published
tebako machinery.

### Cold verification

The build is exercised cold on every PR and every docs publish in
`build_deploy.yml` (ubuntu-latest, clean store). To verify it cold
yourself, run the same shape in a clean container — the transcript below
is the canonical evidence (see the pull request that introduced this
directory for the recorded run):

```console
$ docker run --rm -v "$PWD":/work -w /work ubuntu:24.04 bash -c '
    apt-get update -qq && apt-get install -y -qq curl ca-certificates git nodejs npm fontconfig fonts-dejavu-core &&
    npm ci &&
    curl -sSfL -o tebako https://github.com/tamatebako/tebako/releases/download/v2.8.83/tebako-2.8.83-linux-gnu-arm64 &&
    curl -sSfL -o tebako.sha256 https://github.com/tamatebako/tebako/releases/download/v2.8.83/tebako-2.8.83-linux-gnu-arm64.sha256 &&
    sed "s/  tebako-.*$/  tebako/" tebako.sha256 | sha256sum -c - &&
    chmod 755 tebako && export PATH="$PWD:$PATH" &&
    tebako add-registry tfs:github:tebako-packages/registry --name official &&
    tebako install metanorma@1.18.6 &&
    export PATH="$HOME/.tebako/shims:$PATH" &&
    npm run book'
```

(Use `linux-gnu-x86_64` in the two download URLs on an x86_64 host.)

## Iterating

- `npm run book:offline` reuses the fetched snapshot in `build/` — fast
  iteration on the entry point or the tool without refetching. If the
  entry point's chapter list drifts from the snapshot, the build says so
  and stops.
- `BOOK_SPEC_REF=<ref>` builds against another ref of
  `tamatebako/tebako` (a branch, a tag, or an exact commit).
- The colophon chapter of every build records: the exact spec-source
  commit, the per-chapter Markdown blob SHAs (the sync discipline's own
  provenance), the toolchain identity, and the build date. Artifact
  checksums are in `dist/build-manifest.json`.

## Known platform note

The canonical build platform is Linux (CI: `ubuntu-latest`). On macOS the
current metanorma payload can trip a fontist system-index serialization
issue against the macOS system font set (`Fontist::SystemIndexFont`
raising in `lutaml-model` during the font-resolution leg of a compile) —
tracked upstream in the fontist/lutaml-model line, not in this build. The
Linux container path above is the portable cold check on non-Linux hosts.
