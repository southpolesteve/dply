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

need uname
need mkdir
need chmod

if command -v curl >/dev/null 2>&1; then
  download() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  download() { wget -q -O "$2" "$1"; }
else
  echo "dply installer requires curl or wget." >&2
  exit 1
fi

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64) arch="x64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

asset="dply-${os}-${arch}"
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
