// The perf page's authored layer: axis presentation for the benchmark
// covenant's cells. The machine-readable data lives in the generated
// src/data/perf.json — this file is the human layer on top: what each
// axis measures and in which order the page walks them. An axis
// missing here renders with its raw name and no blurb; nothing breaks.

export interface AxisMeta {
  label: string
  blurb: string
}

// The covenant's cell order, grouped: what a user feels first, what a
// packager repeats last.
export const AXIS_ORDER = ['first-response', 'steady', 'filesystem', 'memory', 'teardown', 'author-loop'] as const

export const AXIS_META: Record<string, AxisMeta> = {
  'first-response': {
    label: 'First response',
    blurb:
      'The wrapper, mount, and interpreter boot a user feels once per dispatch, cold store and warm. The budget is absolute: against a fast native baseline the fixed cost is the measurement, not a ratio.',
  },
  steady: {
    label: 'Steady state',
    blurb:
      'Compute and sequential-read throughput against the same interpreter installed on the system. The workloads run long enough that the fixed boot cost amortizes away; what remains is a property of tebako, not of the runner.',
  },
  filesystem: {
    label: 'Filesystem',
    blurb:
      'The per-call cost of routing file operations through the mount, measured by walking the runtime\'s own tree. The bound records the measured worst leg with headroom; the gate trips on regression, never on the architecture\'s honest cost.',
  },
  memory: {
    label: 'Memory',
    blurb:
      'The resident set the mount machinery carries at steady state, as an absolute peak across every workload leg.',
  },
  teardown: {
    label: 'Teardown',
    blurb:
      'The lifecycle pair: the exit tail a finished dispatch shows, and exec-cache materialization measured against whole-image extraction of the same runtime.',
  },
  'author-loop': {
    label: 'The author loop',
    blurb:
      'The press-and-run cycle a packager repeats while working: re-pressing an unchanged project, and the first execution of a pressed package, warm store.',
  },
}

// The last-N readings the page renders per triplet; the data file
// carries the full published window.
export const TREND_READING_CAP = 12
