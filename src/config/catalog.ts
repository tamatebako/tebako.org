// The catalog's authored layer: one-line descriptions and kind
// presentation for the payloads of the official aggregate registry
// (tebako-packages/registry). The machine-readable data lives in the
// generated src/data/catalog.json — this file is the human layer on
// top. A payload missing from DESCRIPTIONS renders without a
// description line; nothing breaks.

export interface KindMeta {
  label: string
  plural: string
  blurb: string
}

// The page's section order: what a visitor installs first, what it
// rides on last.
export const KIND_ORDER = ['app', 'toolkit', 'runtime'] as const

export const KIND_META: Record<string, KindMeta> = {
  app: {
    label: 'Application',
    plural: 'Applications',
    blurb:
      'Application payloads provide entrypoints and declare a runtime requirement. The loader mounts the newest compatible runtime from the local store and hands off to the entrypoint.',
  },
  toolkit: {
    label: 'Toolkit',
    plural: 'Toolkits',
    blurb:
      'Toolkit payloads are self-contained: they declare no runtime requirement and run as mounted.',
  },
  runtime: {
    label: 'Runtime',
    plural: 'Runtimes',
    blurb:
      'A runtime is the interpreter executable plus its environment image. It is downloaded once into the shared store and mounted, never extracted, by every payload that requires its engine.',
  },
  data: {
    label: 'Data',
    plural: 'Data',
    blurb: 'Data payloads carry files other payloads mount.',
  },
}

export const DESCRIPTIONS: Record<string, string> = {
  // Applications.
  metanorma:
    'The Metanorma standards-authoring CLI, packaged with its full document chain: the JVM leg for PDF rendering and the xml2rfc edge for the IETF flavor included.',
  xml2rfc:
    'The IETF xml2rfc renderer. Drafts and RFCs compile from XML with no host Python anywhere.',
  fontist:
    'The fontist CLI. It installs and manages the fonts that documents declare, from a formula repository.',
  'hello-ruby': 'The reference hello-world application on the Ruby runtime.',
  'hello-python': 'The reference hello-world application on the CPython runtime.',
  'hello-java': 'The reference hello-world application on the OpenJDK runtime.',
  'hello-jruby': 'The reference hello-world application on the JRuby runtime.',
  'hello-truffleruby': 'The reference hello-world application on the TruffleRuby runtime.',
  'hello-node': 'The reference hello-world application on the Node.js runtime.',
  'hello-bun': 'The reference hello-world application on the Bun runtime.',
  // Toolkits.
  hello:
    'GNU hello as a self-contained toolkit payload. The smallest artifact tebako ships and the prover for the feedstock template.',
  'hello-flavor-acme':
    'A flavored build of the hello toolkit, published under the example acme flavor.',
  inkscape:
    'The Inkscape graphics toolkit: SVG import, conversion, and export as a relocatable image.',
  'tebako-crypto':
    'The tebako crypto library, OpenPGP over librnp with Botan, packed so that downstream products never compile it.',
  // Runtimes.
  ruby: 'The MRI Ruby interpreter and its environment image.',
  python: 'The CPython interpreter and its environment image.',
  node: 'The Node.js interpreter and its environment image.',
  bun: 'The Bun interpreter and its environment image.',
  openjdk: 'The Eclipse Temurin build of OpenJDK and its environment image.',
  'openjdk-graalvm': 'The GraalVM Community Edition JDK and its environment image.',
  jruby: 'The JRuby runtime: Ruby on the JVM.',
  truffleruby: 'The TruffleRuby runtime, native build.',
  'truffleruby-jvm': 'The TruffleRuby runtime, JVM build.',
  'tebako-runtime-java-temurin':
    'The legacy name of the Temurin Java runtime. Its published rows stay installable; new work resolves the openjdk payload.',
  'tebako-runtime-python':
    'The legacy name of the CPython runtime. Its published rows stay installable; new work resolves the python payload.',
  // Published as a payload when the CLI ships in that form.
  'tebako-cli': 'The tebako command line itself, distributed as a payload.',
}
