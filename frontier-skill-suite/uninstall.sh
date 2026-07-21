#!/usr/bin/env bash
# frontier-skill-suite uninstaller — removes ONLY skills installed by this package.
# Usage: ./uninstall.sh [--project] [--target DIR] [--yes]
#   default          uninstall from ~/.claude/skills/
#   --project        uninstall from ./.claude/skills/
#   --target DIR     uninstall from DIR
#   --yes            skip confirmation prompt
# Backups created by install.sh (*.backup.*) are NOT touched.
set -euo pipefail

TARGET="${HOME}/.claude/skills"
YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project) TARGET="$(pwd)/.claude/skills" ;;
    --target)  shift; TARGET="${1:?--target requires a directory}" ;;
    --yes)     YES=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "error: unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

SKILLS="frontier-blindspot frontier-spec frontier-orchestrate frontier-one-shot frontier-parallel frontier-verify frontier-debug-review frontier-memory frontier-analyst frontier-visual-qa frontier-shared"

found=""
for s in $SKILLS; do
  # Only remove a directory we plausibly installed: it must contain SKILL.md,
  # or be the shared reference dir. Anything else is left alone and reported.
  if [ -d "$TARGET/$s" ]; then
    if [ -f "$TARGET/$s/SKILL.md" ] || [ "$s" = "frontier-shared" ]; then
      found="$found $s"
    else
      echo "skip: $TARGET/$s exists but doesn't look like a suite skill (no SKILL.md); not removing." >&2
    fi
  fi
done

if [ -z "$found" ]; then
  echo "Nothing to uninstall in $TARGET."
  exit 0
fi

echo "Will remove from $TARGET:"
for s in $found; do echo "  - $s"; done
if [ "$YES" -ne 1 ]; then
  printf "Proceed? [y/N] "
  read -r ans
  case "$ans" in y|Y|yes|YES) ;; *) echo "Aborted; nothing removed."; exit 1 ;; esac
fi

for s in $found; do
  rm -rf "${TARGET:?}/$s"
  echo "removed: $s"
done
echo "Done. Backups (*.backup.*) and unrelated skills were not touched."
