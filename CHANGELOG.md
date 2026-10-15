# Changelog

This file no longer carries release notes (Kim, 2026-10-15). What shipped, and when, lives in the two
places below; the milestone history written here until 2026-10-15 is archived, unedited, at
[`.claude/docs/archive/changelog-to-2026-10-15.md`](.claude/docs/archive/changelog-to-2026-10-15.md).

## Merged pull requests

Every change lands as one pull request against `main`, titled `T-NNNN: <title>` after its ticket in
`.sdlc/tickets/`. The merged list is the change log of record:
[github.com/kimgranlund/agent-ui/pulls?q=is:pr+is:merged](https://github.com/kimgranlund/agent-ui/pulls?q=is%3Apr+is%3Amerged).

## Releases

Releases are git tags (`v0.0.2` through `v0.1.0`, the latest on 2026-08-26), published by
`npm run publish:packages -- <version>` as the lockstep `@agent-ui-kit/*` npm set:
[github.com/kimgranlund/agent-ui/tags](https://github.com/kimgranlund/agent-ui/tags). The source on
`main` is unreleased work past the latest tag.
