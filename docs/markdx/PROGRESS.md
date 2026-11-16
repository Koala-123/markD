# markDX progress

Read this first after any context reset. Then read `FORK_DELTA.md` (what is
protected) and `BASELINE.md` (what "green" means here).

## Where things stand

| Phase | Status | Branch |
|---|---|---|
| Step 0: audit | **done** | `markdx/step-0-audit` |
| Phase 0: rebrand | next | `brand/markdx` |
| Phase 1: modes shell | not started | `markdx/phase-1-modes` |
| Phase 2: Marp decks | not started | `markdx/phase-2-marp` |
| Phase 3: notebooks | not started, **blocked on Q1** | `markdx/phase-3-notebooks` |
| Phase 4: Zotero | not started, **blocked on Q1** | `markdx/phase-4-zotero` |
| Phase 5: brand, UI, marketing | not started | `markdx/phase-5-brand` |

## Done

- Step 0: remotes, branches and history audited; the five fork commits read in full;
  `FORK_DELTA.md` and `BASELINE.md` written.

## Next

Phase 0, on `brand/markdx` cut from `markdx/step-0-audit`:

1. Draw the icon and wordmark SVGs in `brand/` (Phase 0 needs them for the app icons).
2. Write the rename as a script with a dry-run mode, so it can be replayed on a
   different base if Q1 is answered "sync first".
3. Dry run, review the list, apply, run again and confirm no change.
4. `MARKDX_*` environment variables, user-data migration, installer and `.desktop` files.
5. Build, launch, screenshot, run checks against `BASELINE.md`, fresh reviewer, PR.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | `origin` is treated as upstream; no `upstream` remote added. | `origin` already points at `marktext/marktext`. |
| D2 | Push only to the `fork` remote. Every `gh` command passes `--repo Koala-123/markD`. | `origin` is upstream. A bare `gh pr create` could open a pull request against MarkText itself. |
| D3 | Fork delta is measured against `origin/develop` at `e52106fd`. | `master` is frozen at v0.19.0. |
| D4 | markDX branches are cut from `fix/math-recognition-and-export-compat`, stacked one on the next. Each PR's base is the previous branch in the stack. | `fork/develop` contains none of the fork's five commits, so cutting from it would drop protected work. Stacking keeps each PR to one phase. |
| D5 | pnpm 10.33.4 is run from a temporary folder; installs use `--frozen-lockfile`. | pnpm is not on `PATH`; the lockfile was hand-edited and must not be re-resolved. |
| D6 | Unit tests are compared with `NODE_OPTIONS=--no-experimental-webstorage` (737 pass). | Node 26 breaks one protected spec for reasons unrelated to the code. See `BASELINE.md`. |
| D7 | Work proceeds on the current base (upstream as of `e52106fd`). No upstream merge. | A merge would rewrite protected files. That is the owner's call: see Q1. |

## Open questions for the owner

**Q1. Sync with upstream before the Muya-heavy phases?**
Upstream `develop` is 430 commits ahead (0.24.0-dev) and has restructured Muya's
inline renderer: `rules.ts`, `lexer.ts` and `renderer/inlineMath.ts`, which carry the
fork's math fixes, no longer exist there. A trial merge reports 20 conflicts.

- *Option A, stay on this base.* Nothing protected is touched. But Phase 3 (cell
  block) and Phase 4 (citation inline token) would be written against a Muya
  structure upstream has already replaced, so a later sync means re-doing them.
- *Option B, sync first (recommended before Phase 3).* One dedicated branch that
  merges `origin/develop` and re-applies the math fixes to the new structure, with
  the fork's own tests as the acceptance check. It touches protected files, so it
  needs the owner's go-ahead and review.

Phases 0 to 2 are mostly new files and a scripted rename, so they carry over to
either base. **Phases 3 and 4 wait for this answer.**

**Q2. Unit tests on Node 26.** One protected spec fails only because of Node 26.
Options: run tests on Node 22 or 24 as CI does, or add
`NODE_OPTIONS=--no-experimental-webstorage` to the `test:unit` script. Not changed
without a decision; recommended: the script flag, a one-line edit to
`packages/desktop/package.json`.

**Q3. Real `appId`.** Phase 0 uses the placeholder `com.markdx.app`. The owner needs
to choose the real one before any signed or published build.

## Things to remember

- The fork is public. Anything pushed is visible.
- `CLAUDE.md` is stale in places (website stack, marked version). Trust the code.
- Never run `pnpm format`, `eslint --fix` or any formatter across the repo.
