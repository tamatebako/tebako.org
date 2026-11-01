#!/usr/bin/env ruby
# frozen_string_literal: true

# sync-schemas.rb — the schema reference pages under _docs/reference/ are
# generated twins of the grammars in the product repository
# (docs/spec/schemas/*.yaml in tamatebako/tebako). Each generated page
# records the blob SHA of the schema it was generated from, in a comment
# line:
#
#   // source: docs/spec/schemas/<name>.yaml @ <40-hex blob sha>
#
# Usage:
#   ruby tools/sync-schemas.rb [<product-repo>]          regenerate the pages
#   ruby tools/sync-schemas.rb --check [<product-repo>]  the drift gate
#
# <product-repo> defaults to ../tebako, relative to this repository. The
# gate recomputes the blob SHA of every schema (git hash-object over the
# product repository's working tree, so an uncommitted schema edit also
# trips the gate) and compares it with the recorded value. The schema is
# the source of truth and the page is its rendered twin, so a schema edit
# that lands without the page being regenerated leaves the recorded SHA
# stale and the gate goes red.
#
# The pages are machine-generated: this tool never edits the schemas, and
# the pages are never edited by hand. Regenerate and review.

require "open3"

ROOT = File.expand_path("..", __dir__)
REF_DIR = File.join(ROOT, "_docs", "reference")
SCHEMA_REL = File.join("docs", "spec", "schemas")
MARKER = %r{\A// source: (\S+) @ ([0-9a-f]{40})\s*\z}

SCHEMAS = %w[
  artifact-info audit-ledger layout package-manifest payload-manifest
  registry-log runtime-manifest store-config tpkg-registry trace-event
  versions
].freeze

# The identity fields every schema declares at its head, in table order.
IDENTITY_KEYS = %w[schema schema_version schema_minor status owner].freeze

# Top-level keys that name the document rather than its content, and the
# boilerplate sections shared by every grammar: none of them earns a row
# in the section table.
IDENTITY_EXTRA = %w[edge spec].freeze
BOILERPLATE = %w[evolution declaration refusals deprecated notes].freeze

# Fallback descriptions for content sections whose own comment is a bare
# label (the audit-ledger / registry-log banner style) or absent.
SECTION_FALLBACK = {
  "channel" => "How the trace channel is named, opened, and inherited by spawned children.",
  "journal" => "The journal: its path, its append discipline, and the grammar of one record line.",
  "seal" => "The seal record that anchors the journal: the chained digest and its signature.",
  "filters" => "The filter vocabulary a query against the ledger accepts.",
  "documents" => "The JSON documents the tooling emits, one shape per verb.",
  "outcomes" => "The outcome cases, each with its exit code and its meaning.",
  "row" => "The canonical row line: its columns and their rendering rules.",
  "tree" => "The Merkle tree over the canonical rows, including the proof shape.",
  "head" => "The signed head line: one per published snapshot, chained to its predecessor.",
  "store_layout_marker" => "The on-disk marker that records the store layout era, verified on first access.",
}.freeze

# Authored frontmatter and see-also links per schema. The heading is
# derived from the schema's own title line; everything else the page
# carries is derived from the schema file itself.
META = {
  "artifact-info" => {
    "title" => "artifact-info schema",
    "lede" => "A tebako bootstrap binary carries a description of itself — " \
      "the era it belongs to, the product version, the launcher ABI it speaks, " \
      "and the handoff contract version — embedded in the binary at build time. " \
      "The press command reads it before stitching, and tebako info renders it " \
      "as the contract card. This page is the grammar of that document.",
    "description" => "This page is the artifact-info schema reference: the " \
      "bootstrap self-description document, its identity fields and sections, " \
      "and the full grammar as maintained in the product repository.",
    "see_also" => [
      ["/docs/guides/info-inspect/", "info & inspect"],
      ["/docs/reference/specs/", "Spec index"],
    ],
  },
  "audit-ledger" => {
    "title" => "audit-ledger schema",
    "lede" => "Every tebako process appends one line per audited decision to " \
      "a journal, and a chained-digest seal anchors the journal so that " \
      "tampering is detectable. This page is the grammar of the journal line, " \
      "the seal, the query filters, and the audit documents.",
    "description" => "This page is the audit-ledger schema reference: the " \
      "journal line grammar, the chained seal, the filter vocabulary, the " \
      "audit documents, and the full schema as maintained in the product " \
      "repository.",
    "see_also" => [
      ["/docs/architecture/observability/", "Observability"],
      ["/docs/guides/verify/", "Verify integrity"],
    ],
  },
  "layout" => {
    "title" => "layout schema",
    "lede" => "A runtime's environment image declares its layout in a small " \
      "YAML document, and the runtime driver verifies the declaration after " \
      "mounting the image and before any interpreter handoff, so that a layout " \
      "mismatch is a named error rather than a load failure. This page is the " \
      "grammar of that declaration.",
    "description" => "This page is the layout schema reference: the env-image " \
      "layout declaration the runtime driver verifies, its identity fields " \
      "and sections, and the full grammar as maintained in the product " \
      "repository.",
    "see_also" => [
      ["/docs/architecture/runtime-as-image/", "Runtime as image"],
      ["/docs/reference/specs/", "Spec index"],
    ],
  },
  "package-manifest" => {
    "title" => "package-manifest schema",
    "lede" => "A stitched package carries a composition manifest outside every " \
      "payload image: the package identity, the entries that select payload " \
      "slices, and the package-level jail and environment policy. This page is " \
      "the grammar of that manifest.",
    "description" => "This page is the package-manifest schema reference: the " \
      "composition manifest of a stitched package, its identity fields and " \
      "sections, and the full grammar as maintained in the product repository.",
    "see_also" => [
      ["/docs/reference/manifest/", "Manifest reference"],
      ["/docs/architecture/composition/", "Composition"],
    ],
  },
  "payload-manifest" => {
    "title" => "payload-manifest schema",
    "lede" => "Every payload image carries a manifest that declares the " \
      "payload's identity, what it provides, and what it requires from the " \
      "runtime and from other payloads. The manifest is the authority that " \
      "every other tier mirrors. This page is the grammar of that manifest.",
    "description" => "This page is the payload-manifest schema reference: the " \
      "in-image manifest every payload carries, its identity fields and " \
      "sections, and the full grammar as maintained in the product repository.",
    "see_also" => [
      ["/docs/reference/manifest/", "Manifest reference"],
      ["/docs/guides/data-payload/", "Create a data payload"],
    ],
  },
  "registry-log" => {
    "title" => "registry-log schema",
    "lede" => "A registry can publish a transparency log: a canonical snapshot " \
      "of its rows, a Merkle tree over the snapshot, and a signed head for " \
      "every published state. This page is the grammar of the row, the tree, " \
      "the head, and the verification documents.",
    "description" => "This page is the registry-log schema reference: the " \
      "registry transparency log's canonical row, Merkle tree, signed head, " \
      "and verification documents, with the full grammar as maintained in the " \
      "product repository.",
    "see_also" => [
      ["/docs/guides/registries/", "Run your own registries"],
      ["/docs/reference/registry-schema/", "Registry schema"],
    ],
  },
  "runtime-manifest" => {
    "title" => "runtime-manifest schema",
    "lede" => "A runtime release publishes a manifest that the loader reads " \
      "before any download: the contract era, the handoff version, the mount " \
      "root, and the image layout, with the digests of every artifact. This " \
      "page is the grammar of that release card.",
    "description" => "This page is the runtime-manifest schema reference: the " \
      "runtime release card the loader verifies before download, its identity " \
      "fields and sections, and the full grammar as maintained in the product " \
      "repository.",
    "see_also" => [
      ["/docs/reference/runtime-coverage/", "Runtime coverage"],
      ["/docs/architecture/factories/", "Factories"],
    ],
  },
  "store-config" => {
    "title" => "store-config schema",
    "lede" => "The local store's configuration file carries the operator's " \
      "registries, default versions, and per-tool environment, authored in " \
      "YAML and edited through the toolchain. This page is the grammar of " \
      "that file and of the store's layout marker.",
    "description" => "This page is the store-config schema reference: the " \
      "store configuration grammar, the layout marker, the identity fields " \
      "and sections, and the full schema as maintained in the product " \
      "repository.",
    "see_also" => [
      ["/docs/reference/environment/", "Environment variables"],
      ["/docs/guides/shims/", "Shims & versions"],
    ],
  },
  "tpkg-registry" => {
    "title" => "tpkg-registry schema",
    "lede" => "A registry is a git-hosted YAML file that mirrors the " \
      "resolution fields of the payloads it serves, so the dispatcher can " \
      "select the right artifact for the operator's platform without " \
      "downloading every image. This page is the grammar of that file.",
    "description" => "This page is the tpkg-registry schema reference: the " \
      "registry grammar with its payload entries and per-platform artifacts, " \
      "its identity fields and sections, and the full schema as maintained in " \
      "the product repository.",
    "see_also" => [
      ["/docs/reference/registry-schema/", "Registry schema"],
      ["/docs/guides/publish/", "Publish to your own registry"],
    ],
  },
  "trace-event" => {
    "title" => "trace-event schema",
    "lede" => "With tracing enabled, the runtime emits one structured event " \
      "per interception decision, one JSON line per event, on the channel the " \
      "operator names. This page is the grammar of the event envelope and its " \
      "operation vocabulary.",
    "description" => "This page is the trace-event schema reference: the " \
      "trace bus event envelope, the operation vocabulary, the channel " \
      "discipline, and the full grammar as maintained in the product " \
      "repository.",
    "see_also" => [
      ["/docs/guides/trace/", "Trace a packaged app"],
      ["/docs/architecture/observability/", "Observability"],
    ],
  },
  "versions" => {
    "title" => "versions schema",
    "lede" => "The source factory publishes the upstream versions it patches " \
      "and ships as source tarballs, and the runtime factory consumes that " \
      "declaration when it fetches a source release. This page is the grammar " \
      "of that declaration.",
    "description" => "This page is the versions schema reference: the source " \
      "factory's supported-versions grammar, its identity fields and " \
      "sections, and the full schema as maintained in the product repository.",
    "see_also" => [
      ["/docs/reference/runtime-coverage/", "Runtime coverage"],
      ["/docs/reference/specs/", "Spec index"],
    ],
  },
}.freeze

# The writing rules, mirrored from tests/prose-lint.test.ts so a sanitization
# miss fails the generator loudly instead of failing the site build later.
BANNED_VISIBLE = [
  /\brides\b|\briding\b|\bride\b/i,
  /download, run, done/i,
  /\bthe catch\b/i,
  /is the truth\b/i,
  /\btelescope\b|answer-machine|\blottery\b|\bcitizens?\b|\bvibe\b|plot twist|free lunch|\bpunishment\b|no luck\b|2 a\.m\.|all the way down|strictly exceeds/i,
  /hardest [a-z]+ we (ship|know)|we could (find|devise)/i,
  %r{PROGRESS/}i,
  /acceptance run/i,
  /spec \d+/i,
].freeze

def blob_sha(product, relative_path)
  out, status = Open3.capture2("git", "-C", product, "hash-object", "--", relative_path)
  status.success? ? out.strip : nil
end

# Make a source-derived string safe for visible prose: drop parenthetical
# spec citations, hyphenate bare ones, shield the AsciiDoc traps. Shielding
# applies only outside existing `code` spans.
def sanitize(text)
  s = text.gsub(/\([^)]*\bspec[ \-]?\d[^)]*\)/i, "")
  s = s.gsub(/\s*\([^)]*\bIMPLEMENTED\b[^)]*\)/i, "")
  s = s.gsub(/\bspec (\d+)/i, 'spec-\1')
  s = s.gsub(/\bSSOT\b/, "single source of truth")
  s = s.sub(/\A(?:since\s+)?(?:spec-\d+(?:\s*§[\w.]+)?|schema_minor \d+|minor \d+|tebako#\d+)(?:\s*\([^)]*\))?\s*(?:—|:)\s*/i, "")
  s = s.split(/(`[^`]*`)/).map!.with_index do |part, index|
    next part if index.odd?

    part
      .gsub(/\S*<[^>\s]+>\S*/) { |m| "`#{m}`" }
      .gsub(/\+?\S*__\S*\+?/) { |m| m.start_with?("+") ? m : "+#{m}+" }
  end.join
  s = s.gsub(/[ \t]{2,}/, " ")
  s = s.gsub(/\s+([,.;:])/, '\1')
  s = s.gsub(/\(\s+/, "(").gsub(/\s+\)/, ")")
  s.strip
end

def terminal_period(text)
  text.match?(/[.:]\z/) ? text : "#{text}."
end

# Keep whole sentences, never a clipped fragment: as many as fit the limit,
# at least one (length is not a fault; a cut mid-sentence would be).
def cap_sentences(text, limit = 280)
  return text if text.length <= limit

  sentences = text.split(/(?<=\.)\s+(?=[A-Z0-9"'(`+])/)
  out = +""
  sentences.each do |sentence|
    break unless out.empty? || out.length + sentence.length + 1 <= limit

    out = out.empty? ? sentence.dup : "#{out} #{sentence}"
  end
  out.empty? ? sentences.first : out
end

def table_cell(text)
  sanitize(text).gsub("|", "\\|")
end

# Fold a long frontmatter value the way the existing pages carry it.
def fold_frontmatter(key, value, width: 76, indent: "  ")
  lines = []
  line = +""
  value.split.each do |word|
    if line.empty?
      line = word.dup
    elsif line.length + 1 + word.length <= width
      line += " " + word
    else
      lines << line
      line = word.dup
    end
  end
  lines << line unless line.empty?
  "#{key}: >-\n#{lines.map { |l| "#{indent}#{l}" }.join("\n")}\n"
end

# The leading comment block of a schema, as paragraphs. Banner lines carry
# no words and are dropped; paragraphs split on blank comment lines.
def header_paragraphs(lines)
  comment = []
  lines.each do |line|
    break unless line.start_with?("#")

    comment << line.sub(/\A#\s?/, "")
  end
  comment = comment.reject { |l| !l.strip.empty? && l.gsub(/[=\-─═|]/, "").strip.empty? }
  paragraphs = []
  current = []
  comment.each do |line|
    if line.strip.empty?
      paragraphs << current unless current.empty?
      current = []
    else
      current << line
    end
  end
  paragraphs << current unless current.empty?
  paragraphs
end

# The page heading comes from the schema's own title line:
# "<name>.yaml — the short title (citations)".
def derive_heading(title_paragraph)
  joined = title_paragraph.join(" ")
  short = joined.split(" — ", 2)[1]
  return nil unless short

  short = short.gsub(/\s+\([^)]*\)\s*$/, "").strip
  terminal_period(short.sub(/\A[a-z]/, &:upcase))
end

# Render one purpose paragraph. Lines indented inside the comment block are
# enumerations and render as a bullet list under the paragraph's lead line.
def render_paragraph(lines)
  lead, items = lines.partition { |l| l.match?(/\A\S/) }
  out = +""
  unless lead.empty?
    out << sanitize(lead.join(" ")) << "\n"
    out << "\n" unless items.empty?
  end
  items.each do |item|
    item = item.strip
    item = item.sub(/\s{2,}/, " — ") unless item.include?("—")
    out << "* #{sanitize(item.gsub(/[ \t]{2,}/, " "))}\n"
  end
  out
end

# A paragraph is project-to-itself coordination, not reader content, when it
# opens with the ownership marker.
def internal_paragraph?(lines)
  joined = lines.join(" ")
  joined.match?(/\ASSOT:/) || joined.match?(/\ATHIS FILE\b/)
end

# Top-level keys in document order, with the comment block directly above
# each key (banner decorations stripped) and any inline comment on the key
# line itself.
def top_level_keys(lines)
  keys = []
  lines.each_with_index do |line, index|
    next unless (match = line.match(/\A([a-z_]+):(.*)\z/))

    key = match[1]
    rest = match[2]
    comment = []
    walk = index - 1
    while walk >= 0 && lines[walk].start_with?("#")
      comment.unshift(lines[walk].sub(/\A#\s?/, ""))
      walk -= 1
    end
    inline = rest[/#\s*(.+)\z/, 1]
    keys << { key: key, line: index, comment: comment, inline: inline }
  end
  keys
end

# The grammar children of a grammar: section, each with its block of lines
# for notes/structure extraction.
def grammar_children(lines, grammar_line)
  children = []
  current = nil
  lines[(grammar_line + 1)..].each do |line|
    break if line.match?(/\A[a-z_]+:/)

    if (match = line.match(/\A  "?([a-z_]+)"?:(.*)\z/))
      current = { key: match[1], first: match[2], block: [] }
      children << current
    elsif current
      current[:block] << line
    end
  end
  children
end

# A child's own notes: the direct notes: key (inline, quoted, or folded), or
# the notes member of a flow-style field line.
def child_notes(child)
  flow = child[:first][/\bnotes:\s*"((?:[^"\\]|\\.)*)"/, 1] ||
    child[:first][/\bnotes:\s*([^,}]+)/, 1]
  return flow.gsub('\"', '"').strip if flow

  child[:block].each_with_index do |line, index|
    next unless (match = line.match(/\A    notes:\s*(.*)\z/))

    value = match[1].strip
    if value.empty? || value == ">-" || value == ">"
      folded = []
      walk = index + 1
      while walk < child[:block].length && child[:block][walk].match?(/\A      \S/)
        folded << child[:block][walk].strip
        walk += 1
      end
      value = folded.join(" ")
    end
    value = value.sub(/\A"/, "").sub(/"\z/, "").gsub('\"', '"')
    return value.strip unless value.empty?
  end
  nil
end

# A structural description when a child carries no notes of its own: the
# declared type and cardinality, with the field names of a map.
def structural_description(child)
  first = child[:first]
  type = first[/\btype:\s*"((?:[^"\\]|\\.)*)"/, 1] || first[/\btype:\s*([^,}]+)/, 1]
  required = first[/\brequired:\s*(true|false)/, 1]
  child[:block].each do |line|
    type ||= line[/\A    type:\s*(.+)\z/, 1]&.strip
    required ||= line[/\A    required:\s*(true|false)/, 1]
  end
  type = type&.sub(/\A"(.*)"\z/, '\1')
  cardinality = { "true" => "required", "false" => "optional" }[required]

  fields = nil
  if (field_start = child[:block].index { |l| l.match?(/\A    fields:\s*\z/) })
    names = []
    child[:block][(field_start + 1)..].each do |line|
      break if line.match?(/\A {0,5}\S/)

      if (match = line.match(/\A      ("?)([a-z_]+)\1:/))
        names << match[2]
      end
    end
    if names.any?
      shown = names.first(8)
      suffix = names.length > 8 ? ", and #{names.length - 8} more" : ""
      fields = "fields #{shown.join(', ')}#{suffix}"
    end
  end

  parts = [type&.capitalize, cardinality].compact
  if parts.empty?
    keys = child[:block].filter_map { |l| l[/\A    ("?)([a-z_]+)\1:/, 2] }
    return "Declared below." if keys.empty?

    shown = keys.first(8)
    suffix = keys.length > 8 ? ", and #{keys.length - 8} more" : ""
    return terminal_period("Map — keys #{sanitize(shown.join(', '))}#{suffix}")
  end

  base = parts.join(", ")
  terminal_period(fields ? "#{base} — #{sanitize(fields)}" : base)
end

# One section-table row for a grammar child.
def child_row(child)
  notes = child_notes(child)
  description = notes ? terminal_period(cap_sentences(sanitize(notes))) : structural_description(child)
  ["`#{child[:key]}`", table_cell(description.sub(/\A[a-z]/, &:upcase))]
end

# One section-table row for a content top-level section (the grammar-less
# schemas, and the extra top-level content sections such as channel:).
def section_row(entry, lines)
  comment = entry[:comment]
    .map { |l| l.gsub(/[─═]/, " ").strip }
    .reject(&:empty?)
    .join(" ")
    .strip
  inline = entry[:inline]&.strip
  derived = comment
  derived = inline if derived.empty? && inline
  description = sanitize(derived)
  if description.split.length < 4
    description = SECTION_FALLBACK.fetch(entry[:key], "The #{entry[:key]} section.")
  end
  ["`#{entry[:key]}`", terminal_period(cap_sentences(table_cell(description.sub(/\A[a-z]/, &:upcase))))]
end

def identity_rows(lines)
  IDENTITY_KEYS.map do |key|
    line = lines.find { |l| l.match?(/\A#{key}:/) }
    abort "sync-schemas.rb: schema has no #{key}: line" unless line

    value = line.sub(/\A#{key}:\s*/, "").sub(/\s+#.*\z/, "").strip
    [key, table_cell(value)]
  end
end

def table(header, rows)
  out = +"[cols=\"1,3\"]\n|===\n| #{header[0]} | #{header[1]}\n\n"
  rows.each do |row|
    out << "| #{row[0]}\n| #{row[1]}\n\n"
  end
  out << "|===\n"
end

def build_page(name, raw, sha)
  meta = META.fetch(name)
  lines = raw.lines(chomp: true)

  paragraphs = header_paragraphs(lines)
  heading = derive_heading(paragraphs.first)
  abort "sync-schemas.rb: #{name} has no derivable title line" unless heading

  purpose = paragraphs[1..].reject { |p| internal_paragraph?(p) }
  abort "sync-schemas.rb: #{name} has no purpose paragraphs" if purpose.empty?

  keys = top_level_keys(lines)
  grammar = lines.index { |l| l == "grammar:" }

  rows = []
  keys.each do |entry|
    next if (IDENTITY_KEYS + IDENTITY_EXTRA).include?(entry[:key])

    if entry[:key] == "grammar"
      grammar_children(lines, entry[:line]).each { |child| rows << child_row(child) }
    elsif !BOILERPLATE.include?(entry[:key])
      rows << section_row(entry, lines)
    end
  end
  abort "sync-schemas.rb: #{name} produced an empty section table" if rows.empty?

  source_rel = "#{SCHEMA_REL}/#{name}.yaml"
  page = +"---\n"
  page << "title: #{meta['title']}\n"
  page << "heading: #{heading}\n"
  page << fold_frontmatter("lede", meta["lede"])
  page << fold_frontmatter("description", meta["description"])
  page << "---\n\n"
  page << "// source: #{source_rel} @ #{sha}\n"
  page << "// generated by tools/sync-schemas.rb from tamatebako/tebako — edit\n"
  page << "// the schema there and re-run the generator; do not edit by hand.\n\n"
  page << "== What it defines.\n\n"
  purpose.each { |p| page << render_paragraph(p) << "\n" }
  page << "== Identity.\n\n"
  page << table(["Field", "Value"], identity_rows(lines)) << "\n"
  page << "== Sections.\n\n"
  page << table(["Section", "What it declares"], rows) << "\n"
  page << "== The full grammar.\n\n"
  page << "[source,yaml]\n----\n#{raw}#{raw.end_with?("\n") ? "" : "\n"}----\n\n"
  page << "The source of truth is\n"
  page << "link:https://github.com/tamatebako/tebako/blob/main/#{source_rel}[`#{source_rel}`]\n"
  page << "in the product repository; this page is regenerated from it by\n"
  page << "`tools/sync-schemas.rb`.\n\n"
  page << "See also: #{meta['see_also'].map { |href, label| "link:#{href}[#{label}]" }.join(" · ")}\n"
  page
end

# The prose-lint rules applied to the page's visible text, so a
# sanitization gap fails here with the schema named.
def guard_visible_text(name, page)
  visible = page
    .sub(/\A---\n[\s\S]*?\n---/, " ")
    .gsub(%r{\A//.*$}, " ")
    .gsub(/\[source[^\]]*\]\n----\n[\s\S]*?\n----/, " ")
  BANNED_VISIBLE.each do |pattern|
    next unless (match = pattern.match(visible))

    at = [match.begin(0) - 40, 0].max
    context = visible[at, 100].gsub(/\s+/, " ")
    abort "sync-schemas.rb: #{name}: visible prose matches #{pattern.inspect}: …#{context}…"
  end
end

check = ARGV.delete("--check")
product = File.expand_path(ARGV.shift || "../tebako", ROOT)
abort "usage: sync-schemas.rb [--check] [<product-repo>]" unless ARGV.empty?

unless File.directory?(File.join(product, SCHEMA_REL))
  abort "sync-schemas.rb: #{product} does not look like the product repository " \
    "(no #{SCHEMA_REL}/ directory)"
end

if check
  drifted = []
  SCHEMAS.each do |name|
    page_path = File.join(REF_DIR, "schema-#{name}.adoc")
    unless File.exist?(page_path)
      drifted << "schema-#{name}.adoc: page does not exist"
      next
    end
    marker = File.readlines(page_path, chomp: true).map(&:strip).find { |l| l.match?(MARKER) }
    unless marker
      drifted << "schema-#{name}.adoc: no source marker"
      next
    end
    src, recorded = marker.match(MARKER).captures
    current = blob_sha(product, src)
    drifted << "schema-#{name}.adoc: #{src} is at #{current&.[](0, 12)}…, page records #{recorded[0, 12]}…" if current != recorded
  end

  if drifted.empty?
    puts "sync-schemas.rb: #{SCHEMAS.length} pages gated, all pages current"
    exit 0
  end

  warn "sync-schemas.rb: #{drifted.length} page(s) drifted from their schema source:"
  drifted.each { |d| warn "  #{d}" }
  warn "sync-schemas.rb: regenerate with"
  warn "sync-schemas.rb:   ruby tools/sync-schemas.rb <product-repo>"
  exit 1
end

SCHEMAS.each do |name|
  source_rel = "#{SCHEMA_REL}/#{name}.yaml"
  source_path = File.join(product, source_rel)
  abort "sync-schemas.rb: #{source_path} does not exist" unless File.exist?(source_path)

  raw = File.read(source_path)
  sha = blob_sha(product, source_rel)
  abort "sync-schemas.rb: could not hash-object #{source_rel}" unless sha

  page = build_page(name, raw, sha)
  guard_visible_text(name, page)

  page_path = File.join(REF_DIR, "schema-#{name}.adoc")
  File.write(page_path, page)
  puts "wrote _docs/reference/schema-#{name}.adoc (#{sha[0, 12]}…)"
end
puts "sync-schemas.rb: #{SCHEMAS.length} pages regenerated"
