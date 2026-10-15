#!/usr/bin/env bash
# Confirms every path and package named in findings.md exists. Run from anywhere.
set -e
cd "$(dirname "$0")/../.."
fail=0
for p in $(grep -oE '`[A-Za-z0-9_./-]+\.(ts|css|mjs|sh|json)(:[0-9-]+)?`' .sdlc/package-deps-audit/findings.md | tr -d '`' | sed 's/:.*//' | sort -u); do
  [ -e "$p" ] || [ -e "packages/agent-ui/$p" ] || [ -e ".sdlc/package-deps-audit/$p" ] || [ -e "packages/agent-ui/${p#../../}" ] || [ -n "$(find packages -name node_modules -prune -o -path "*/$p" -print -quit)" ] || { echo "MISSING $p"; fail=1; }
done
for k in a2a a2ui app code components data devtools icons router shared; do [ -f packages/agent-ui/$k/package.json ] || { echo "MISSING pkg $k"; fail=1; }; done
exit $fail
