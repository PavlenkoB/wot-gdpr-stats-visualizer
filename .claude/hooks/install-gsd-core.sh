#!/usr/bin/env bash
# Installs GSD Core into ~/.claude in Claude Code cloud sessions, which start
# from a fresh container without it. Local machines keep their own install.
set -euo pipefail

GSD_CORE_VERSION="1.15.0"

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

version_file="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/gsd-core/VERSION"
if [ "$(cat "$version_file" 2>/dev/null)" = "$GSD_CORE_VERSION" ]; then
  exit 0
fi

npx -y "@opengsd/gsd-core@$GSD_CORE_VERSION" --claude --global >&2
