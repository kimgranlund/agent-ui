#!/usr/bin/env bash
# usage: evidence.sh <from-pkg> <to-pkg> [n]  (run from packages/agent-ui); excludes layering tests
grep -rnE "(from|import\(|import) *[\"']@agent-ui/$2[\"'/]|@import[^;]*@agent-ui/$2" "$1" --include=*.ts --include=*.mjs --include=*.css --exclude-dir=node_modules | grep -v layering.test | head -${3:-3}
