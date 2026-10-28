#!/usr/bin/env bash
# Run on the repository owner's computer. Requires GitHub CLI (gh).
# Default: inspect only. --apply adds two rulesets and corrects one description.
set -euo pipefail
umask 077
unset GH_DEBUG

p1_mode=check
case "$#:$*" in
  0:) ;;
  1:--check) ;;
  1:--apply) p1_mode=apply ;;
  *) echo 'Usage: bash p1-github-admin.sh [--check|--apply]' >&2; exit 2 ;;
esac
if ! command -v gh >/dev/null 2>&1; then
  echo 'GitHub CLI is required. On a Mac with Homebrew: brew install gh' >&2
  echo 'Then run this script again. Official installer: https://cli.github.com/' >&2
  exit 2
fi
if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  echo 'Sign into GitHub CLI locally as xmike04. Keep the sign-in code on this computer.'
  gh auth login --hostname github.com --web --git-protocol https --skip-ssh-key
fi
api() {
  gh api --hostname github.com -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' "$@"
}
[ "$(api user --jq .login)" = xmike04 ] || {
  echo 'Stopped: the active GitHub account must be xmike04. No settings changed.' >&2
  exit 2
}
p1_tmp=$(mktemp -d)
trap 'rm -rf "$p1_tmp"' EXIT
p1_report=$(mktemp ./p1-github-report.XXXXXX)
log() { printf '%s\n' "$*" | tee -a "$p1_report"; }
die() { log "STOPPED: $*"; exit 1; }
p1_rule_name='P1 main quality gates'
p1_description='Life simulator with deterministic gameplay, authenticated AI events, and automated Vitest/browser checks.'
p1_old_description='AI-assisted life simulator with deterministic game logic, authenticated OpenAI events, Firebase cloud saves, and 350+ Vitest assertions.'

contexts() {
  case "$1" in
    SIMLYFE) echo '["Lint, unit tests, build, docs","Desktop and mobile browser smoke"]' ;;
    RAG_OPS) echo '["Backend quality","Frontend quality","Retrieval benchmark integrity","Container configuration"]' ;;
    *) return 1 ;;
  esac
}
payload() {
  p1_checks=$(contexts "$1")
  # Construct JSON through gh's built-in jq; no separate jq install is needed.
  api "repos/xmike04/$1" --jq \
    "$p1_checks | {name:\"P1 main quality gates\",target:\"branch\",enforcement:\"active\",
     bypass_actors:[],conditions:{ref_name:{include:[\"refs/heads/main\"],exclude:[]}},
     rules:[{type:\"deletion\"},{type:\"non_fast_forward\"},
       {type:\"pull_request\",parameters:{dismiss_stale_reviews_on_push:false,
        require_code_owner_review:false,require_last_push_approval:false,
        required_approving_review_count:0,required_review_thread_resolution:false}},
       {type:\"required_status_checks\",parameters:{strict_required_status_checks_policy:true,
        do_not_enforce_on_create:false,required_status_checks:map({context:.,integration_id:15368})}}]}" \
    > "$p1_tmp/$1-ready.json"
}
verify_rule() {
  p1_repo=$1
  p1_id=$2
  p1_expected=$(contexts "$p1_repo")
  p1_query="[
    .name == \"P1 main quality gates\", .target == \"branch\", .enforcement == \"active\",
    ((.bypass_actors // []) | length) == 0,
    .conditions.ref_name.include == [\"refs/heads/main\"], .conditions.ref_name.exclude == [],
    (.rules | length) == 4,
    ([.rules[].type] | sort) == ([\"deletion\",\"non_fast_forward\",\"pull_request\",\"required_status_checks\"] | sort),
    ([.rules[] | select(.type == \"pull_request\") | .parameters |
      .required_approving_review_count == 0 and .dismiss_stale_reviews_on_push == false and
      .require_code_owner_review == false and .require_last_push_approval == false and
      .required_review_thread_resolution == false] | all),
    ([.rules[] | select(.type == \"required_status_checks\") | .parameters |
      .strict_required_status_checks_policy == true and .do_not_enforce_on_create == false and
      ([.required_status_checks[].context] | sort) == ($p1_expected | sort) and
      all(.required_status_checks[]; .integration_id == 15368)] | all)
  ] | all"
  [ "$(api "repos/xmike04/$p1_repo/rulesets/$p1_id" --jq "$p1_query")" = true ]
}

log "P1 GitHub administration - $(date -u +%Y-%m-%dT%H:%M:%SZ) - mode=$p1_mode"
log 'Scope: SIMLYFE/RAG_OPS main; SIMLYFE About; read-only alert metadata for four P1 repositories.'
log 'Policy: PR + current successful quality checks; no admin bypass; block force pushes/deletion; zero required reviewers.'
log 'Existing policies are never edited or removed. A conflicting P1 ruleset stops this script.'

# Finish every preflight before any write.
for p1_repo in SIMLYFE RAG_OPS; do
  [ "$(api "repos/xmike04/$p1_repo" --jq '.permissions.admin == true and .default_branch == "main" and .archived == false')" = true ] ||
    die "$p1_repo: current account lacks administration access or repository state changed."
  p1_head=$(api "repos/xmike04/$p1_repo/branches/main" --jq .commit.sha)
  printf '%s\n' "$p1_head" > "$p1_tmp/$p1_repo-head"
  p1_expected=$(contexts "$p1_repo")
  p1_query=".check_runs as \$runs | $p1_expected | map(. as \$wanted |
    any(\$runs[]; .name == \$wanted and .app.slug == \"github-actions\" and
      .app.id == 15368 and .status == \"completed\" and .conclusion == \"success\")) | all"
  [ "$(api "repos/xmike04/$p1_repo/commits/$p1_head/check-runs?filter=latest&per_page=100" --jq "$p1_query")" = true ] ||
    die "$p1_repo: a required GitHub Actions job is absent, pending, or failing on main."
  p1_ids=$(api "repos/xmike04/$p1_repo/rulesets?includes_parents=true&per_page=100" --paginate \
    --jq ".[] | select(.name == \"$p1_rule_name\") | .id")
  if [ -n "$p1_ids" ]; then
    case "$p1_ids" in *[!0-9]*) die "$p1_repo: duplicate or invalid P1 ruleset IDs." ;; esac
    verify_rule "$p1_repo" "$p1_ids" || die "$p1_repo: existing P1 ruleset differs; preserving it."
  fi
  printf '%s\n' "$p1_ids" > "$p1_tmp/$p1_repo-id"
  payload "$p1_repo"
  log "$p1_repo: admin access, main $p1_head, all required Actions jobs successful."
done
p1_about=$(api repos/xmike04/SIMLYFE --jq '.description // ""')
[ "$p1_about" = "$p1_old_description" ] || [ "$p1_about" = "$p1_description" ] ||
  die 'SIMLYFE description changed since review; preserving it.'

if [ "$p1_mode" = apply ]; then
  for p1_repo in SIMLYFE RAG_OPS; do
    [ "$(api "repos/xmike04/$p1_repo/branches/main" --jq .commit.sha)" = "$(cat "$p1_tmp/$p1_repo-head")" ] ||
      die "$p1_repo: main changed during preflight; rerun for fresh checks."
  done
  for p1_repo in SIMLYFE RAG_OPS; do
    p1_id=$(cat "$p1_tmp/$p1_repo-id")
    if [ -z "$p1_id" ]; then
      p1_id=$(api --method POST "repos/xmike04/$p1_repo/rulesets" \
        --input "$p1_tmp/$p1_repo-ready.json" --jq .id)
    fi
    case "$p1_id" in ''|*[!0-9]*) die "$p1_repo: invalid ruleset response; inspect settings before retrying." ;; esac
    verify_rule "$p1_repo" "$p1_id" || die "$p1_repo: readback failed; no rollback or bypass attempted."
    log "$p1_repo: enforced ruleset $p1_id VERIFIED; https://github.com/xmike04/$p1_repo/rules/$p1_id"
  done
  if [ "$p1_about" != "$p1_description" ]; then
    [ "$(api repos/xmike04/SIMLYFE --jq '.description // ""')" = "$p1_about" ] || die 'About changed during preflight.'
    api --method PATCH repos/xmike04/SIMLYFE -f "description=$p1_description" --silent
  fi
  [ "$(api repos/xmike04/SIMLYFE --jq .description)" = "$p1_description" ] || die 'About readback failed.'
  log "SIMLYFE About VERIFIED: $p1_description"
else
  log 'Read-only preflight passed. Run with --apply to create/verify the policy and correct About.'
fi

alert_report() {
  p1_repo=$1
  p1_kind=$2
  p1_fields=$3
  if p1_rows=$(api --paginate "repos/xmike04/$p1_repo/$p1_kind/alerts?state=open&per_page=100" \
      --jq "[.[] | $p1_fields]" 2>/dev/null); then
    log "$p1_repo $p1_kind: AVAILABLE; open alert metadata (one array per page):"
    log "$p1_rows"
  else
    log "$p1_repo $p1_kind: UNAVAILABLE (not zero; may be disabled or lack permission)."
  fi
}
for p1_repo in SIMLYFE RAG_OPS xmike04.github.io xmike04; do
  alert_report "$p1_repo" dependabot '{number,state,severity:.security_advisory.severity,advisory:.security_advisory.ghsa_id,package:.dependency.package.name,url:.html_url}'
  alert_report "$p1_repo" code-scanning '{number,state,rule_id:.rule.id,severity:(.rule.security_severity_level // .rule.severity),url:.html_url}'
  alert_report "$p1_repo" secret-scanning '{number,state,type:.secret_type_display_name,url:.html_url}'
done
log 'Alert metadata requires review; unavailable is not zero. No alerts were dismissed or changed.'
log 'This is settings readback, not a demonstrated rejected-merge test or full security audit.'
log "Sanitized report saved: $p1_report"
echo 'Share only this report with ChatGPT. Do not share sign-in codes, tokens, or raw alert responses.'
