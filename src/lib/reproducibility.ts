// Typed access to the generated reproducibility data
// (src/data/reproducibility.json, written by
// tools/build-reproducibility.mjs) plus the presentation helpers the
// reproducibility page and its test share.

import raw from '../data/reproducibility.json'

export interface ReproDigest {
  label: string
  value: string
  // complete: the value is the full 64-hex sha256; incomplete: the
  // cited prefix is all the public record carries (the page renders the
  // ellipsis either way and never invents the rest).
  complete: boolean
}

export interface ReproRun {
  id: number
  url: string
  sha: string
  conclusion: string
}

export interface ReproEvidence {
  name: string
  runs: ReproRun[]
}

export interface ReproVerify {
  tag: string
  ruby_version: string
  command: string
}

export type ReproStatus = 'proven' | 'pending'

export interface ReproLeg {
  id: string
  label: string
  platform: string
  arch: string
  exe_scope: string
  status: ReproStatus
  claim: string
  digests: ReproDigest[]
  evidence: ReproEvidence | null
  note: string | null
  verify: ReproVerify
}

export interface ReproData {
  schema_version: number
  generated_at: string
  source: {
    doc: string
    workflow: string
    runs: string
    release: { tag: string; url: string; ruby_version: string }
  }
  counts: { proven: number; pending: number }
  legs: ReproLeg[]
}

export const REPRO = raw as unknown as ReproData

// The digest as cited: complete values truncate to the doc's prefix
// style, incomplete ones render exactly the recorded prefix. Either way
// the ellipsis says the rendering is a prefix, never the whole digest.
export function shortDigest(d: ReproDigest): string {
  return `${d.complete ? d.value.slice(0, 12) : d.value}…`
}
