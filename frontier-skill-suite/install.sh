#!/usr/bin/env bash
# frontier-skill-suite installer
# Usage: ./install.sh [--project] [--target DIR] [--force]
#   default          install to ~/.claude/skills/
#   --project        install to ./.claude/skills/ (current project)
#   --target DIR     install to DIR (overrides both; mainly for testing)
#   --force          replace existing same-name skills (after backing them up)
set -euo pipefail

SUITE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${HOME}/.claude/skills"
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project) TARGET="$(pwd)/.claude/skills" ;;
    --target)  shift; TARGET="${1:?--target requires a directory}" ;;
    --force)   FORCE=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "error: unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

SKILLS="frontier-blindspot frontier-spec frontier-orchestrate frontier-one-shot frontier-parallel frontier-verify frontier-debug-review frontier-memory frontier-analyst frontier-visual-qa"

# --- preflight: all required sources must exist before we touch the target ---
missing=0
for s in $SKILLS; do
  [ -f "$SUITE_DIR/skills/$s/SKILL.md" ] || { echo "error: missing source: skills/$s/SKILL.md" >&2; missing=1; }
done
for f in operating-principles.md evidence-status.md verification-contract.md; do
  [ -f "$SUITE_DIR/shared/$f" ] || { echo "error: missing source: shared/$f" >&2; missing=1; }
done
[ "$missing" -eq 0 ] || { echo "error: source package incomplete; nothing installed." >&2; exit 1; }

mkdir -p "$TARGET"

# --- conflict scan: never silently destroy an existing skill ---
conflicts=""
for s in $SKILLS frontier-shared; do
  [ -e "$TARGET/$s" ] && conflicts="$conflicts $s"
done
if [ -n "$conflicts" ] && [ "$FORCE" -ne 1 ]; then
  echo "error: existing skill(s) at $TARGET:$conflicts" >&2
  echo "       re-run with --force to back them up and replace them." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
installed=""
backed_up=""

install_one() {
  src="$1"; name="$2"
  if [ -e "$TARGET/$name" ]; then
    mv "$TARGET/$name" "$TARGET/$name.backup.$STAMP"
    backed_up="$backed_up $name"
  fi
  cp -R "$src" "$TARGET/$name"
  installed="$installed $name"
}

install_one "$SUITE_DIR/shared" "frontier-shared"
for s in $SKILLS; do
  install_one "$SUITE_DIR/skills/$s" "$s"
done

echo "Installed to $TARGET:"
for i in $installed; do echo "  + $i"; done
if [ -n "$backed_up" ]; then
  echo "Backed up (previous versions kept):"
  for b in $backed_up; do echo "  ~ $b -> $b.backup.$STAMP"; done
fi
echo "Done. 10 skills + frontier-shared references installed."
