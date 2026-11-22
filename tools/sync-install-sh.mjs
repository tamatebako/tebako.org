// sync-install-sh — keep the served /install.sh byte-identical with the
// tap's. The tap (tamatebako/homebrew-tap) owns the installer; the site
// serves it. A checked-in copy + this drift gate, the same pattern as
// the catalog/perf pipelines: the build itself stays offline-capable,
// and a weekly regeneration lands any drift by PR.
import { readFileSync, writeFileSync } from "node:fs";

const TAP_URL =
  process.env.INSTALL_SH_URL ??
  "https://raw.githubusercontent.com/tamatebako/homebrew-tap/main/install.sh";
const TARGET = "public/install.sh";
const check = process.argv.includes("--check");

const res = await fetch(TAP_URL);
if (!res.ok) {
  console.error(`sync-install-sh: fetch failed: ${res.status} ${res.statusText} (${TAP_URL})`);
  process.exit(1);
}
const upstream = await res.text();
if (!upstream.startsWith("#!/bin/sh") || !upstream.includes("SHA256SUMS")) {
  console.error("sync-install-sh: the fetched file fails the shape check (no shebang / no SHA256SUMS) — refusing");
  process.exit(1);
}

const current = readFileSync(TARGET, "utf8");
if (current === upstream) {
  console.log("sync-install-sh: in sync");
  process.exit(0);
}
if (check) {
  console.error("sync-install-sh: DRIFT — public/install.sh differs from the tap's main; run `npm run install-sh` and commit");
  process.exit(1);
}
writeFileSync(TARGET, upstream);
console.log("sync-install-sh: updated from the tap");
