#!/bin/sh
# tebako installer: detect platform → download the tebako
# binaries + SHA256SUMS from the tamatebako/tebako release → verify sha256
# BEFORE installing anything → install to ~/.local/bin (NEVER sudo) →
# offer the managed PATH block. No dependencies beyond POSIX sh, curl,
# and sha256sum/shasum.
set -eu

REPO="tamatebako/tebako"
BINARIES="tebako tebako-pkg tfs tebako-bootstrap"
DEST="${TEBAKO_INSTALL_DEST:-$HOME/.local/bin}"

die() { echo "install.sh: $*" >&2; exit 1; }

# ------------------------------------------------------------------------
# 1. Platform detection (the four legs, musl included)
# ------------------------------------------------------------------------
os="$(uname -s)"
arch="$(uname -m)"
case "$arch" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64) arch="x86_64" ;;
  *) die "unsupported architecture: $arch" ;;
esac
case "$os" in
  Darwin) platform="macos-$arch" ;;
  Linux)
    if ldd --version 2>&1 | grep -qi musl; then
      platform="linux-musl-$arch"
    else
      platform="linux-gnu-$arch"
    fi
    ;;
  *) die "unsupported OS: $os" ;;
esac

# ------------------------------------------------------------------------
# 2. Version (pin with TEBAKO_VERSION or first arg; default: latest).
# Tags carry the v (v0.1.0); asset names do not (tebako-0.1.0-<platform>).
# ------------------------------------------------------------------------
version="${1:-${TEBAKO_VERSION:-}}"
if [ -z "$version" ]; then
  echo "install.sh: resolving the latest release of $REPO…"
  version="$(curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" | sed 's|.*/||')"
fi
[ -n "$version" ] || die "could not resolve the latest release tag"
vnum="${version#v}"
echo "install.sh: tebako $version for $platform → $DEST"

# ------------------------------------------------------------------------
# 3. Download binaries + SHA256SUMS into a temp dir
# ------------------------------------------------------------------------
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
base="https://github.com/$REPO/releases/download/$version"
for b in $BINARIES; do
  curl -fsSL -o "$tmp/$b" "$base/$b-$vnum-$platform" \
    || die "download failed: $b-$vnum-$platform (does the release ship the $platform leg?)"
done
curl -fsSL -o "$tmp/SHA256SUMS" "$base/SHA256SUMS" || die "download failed: SHA256SUMS"

# ------------------------------------------------------------------------
# 4. Verify sha256 BEFORE installing anything
# ------------------------------------------------------------------------
if command -v sha256sum >/dev/null 2>&1; then
  S256() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
  S256() { shasum -a 256 "$1" | awk '{print $1}'; }
else
  die "need sha256sum or shasum for verification"
fi
for b in $BINARIES; do
  want="$(awk -v f="$b-$vnum-$platform" '$2 == f {print $1}' "$tmp/SHA256SUMS")"
  [ -n "$want" ] || die "no SHA256SUMS entry for $b-$vnum-$platform"
  got="$(S256 "$tmp/$b")"
  [ "$got" = "$want" ] || die "SHA256 MISMATCH for $b (want $want, got $got) — refusing to install"
done
echo "install.sh: sha256 verified for all four binaries"

# ------------------------------------------------------------------------
# 5. Install to ~/.local/bin (NEVER sudo)
# ------------------------------------------------------------------------
mkdir -p "$DEST"
for b in $BINARIES; do
  install -m 0755 "$tmp/$b" "$DEST/$b"
done
echo "install.sh: installed $BINARIES → $DEST"

# ------------------------------------------------------------------------
# 6. PATH: hint or the managed block
# ------------------------------------------------------------------------
case ":$PATH:" in
  *":$DEST:"*) echo "install.sh: $DEST is already on PATH" ;;
  *)
    echo ""
    echo "  $DEST is not on your PATH yet. Either:"
    echo "    • run the app once and let it offer the managed block:"
    echo "        $DEST/tebako --version"
    echo "    • or add it yourself (one line, your shell's startup file):"
    echo "        export PATH=\"$DEST:\$PATH\""
    ;;
esac

echo ""
echo "  Next: $DEST/tebako --version"
echo "        $DEST/tebako install tfs:github:tamatebako/hello"
