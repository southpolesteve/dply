#!/bin/sh
set -eu

DPLY_VERSION="${DPLY_VERSION:-latest}"
DPLY_INSTALL_DIR="${DPLY_INSTALL_DIR:-$HOME/.local/bin}"
DPLY_HOME="${DPLY_HOME:-$HOME/.dply}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "dply installer requires '$1'." >&2
    exit 1
  fi
}

need mkdir
need chmod
need node
need npx

if ! node -e 'const major = Number(process.versions.node.split(".")[0]); process.exit(major >= 20 ? 0 : 1)' >/dev/null 2>&1; then
  echo "dply requires Node.js 20 or newer." >&2
  echo "Wrangler runs through npx, so Node/npm are part of the deployment path." >&2
  exit 1
fi

if command -v curl >/dev/null 2>&1; then
  download() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  download() { wget -q -O "$2" "$1"; }
else
  echo "dply installer requires curl or wget." >&2
  exit 1
fi

asset="dply"
if [ "$DPLY_VERSION" = "latest" ]; then
  default_base_url="https://github.com/southpolesteve/dply/releases/latest/download"
else
  case "$DPLY_VERSION" in
    v*) tag="$DPLY_VERSION" ;;
    *) tag="v$DPLY_VERSION" ;;
  esac
  default_base_url="https://github.com/southpolesteve/dply/releases/download/$tag"
fi
base_url="${DPLY_BASE_URL:-$default_base_url}"
tmp="${DPLY_HOME}/tmp"

mkdir -p "$tmp" "$DPLY_INSTALL_DIR"
download "$base_url/$asset" "$tmp/dply"
chmod +x "$tmp/dply"
mv "$tmp/dply" "$DPLY_INSTALL_DIR/dply"

echo "dply installed to $DPLY_INSTALL_DIR/dply"
if ! command -v dply >/dev/null 2>&1; then
  echo ""
  echo "$DPLY_INSTALL_DIR is not currently on PATH."
  echo "Run this now, or add it to your shell profile:"
  echo "  export PATH=\"$DPLY_INSTALL_DIR:\$PATH\""
  echo ""
  echo "You can also run dply directly:"
  echo "  $DPLY_INSTALL_DIR/dply --help"
fi
