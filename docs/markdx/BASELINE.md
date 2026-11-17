# Baseline: state of the checks before any markDX change

Recorded 2026-11-16 at commit `bcf3af7e` (branch `markdx/step-0-audit`, identical
tree to `fix/math-recognition-and-export-compat`). No source file had been changed
when these ran. Later phases are compared against this table.

## Environment

| Item | Value |
|---|---|
| OS | macOS (Darwin 27.0.0), arm64 |
| Node | v26.7.0 (CI uses 22.21.1 for PRs and 24.14.1 for releases) |
| pnpm | 10.33.4, the version pinned in `packageManager` |

`pnpm` is not installed on this machine's `PATH`. The pinned version was installed
into a temporary folder outside the repo with `npm install --prefix <tmp> pnpm@10.33.4`
and put on `PATH` for each command. Nothing global was changed.

## Results

| # | Command | Where | Result |
|---|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | repo root | **pass**, 21.7 s. Lockfile already up to date. Postinstall downloaded Electron, applied the `native-keymap` patch, rebuilt `ced`, `keytar`, `native-keymap`, minified 10 locales. `git status` clean afterwards. |
| 2 | `pnpm lint` (first half of `pnpm check`) | repo root | **pass**: 0 errors, 135 warnings |
| 3 | `pnpm typecheck` (second half of `pnpm check`) | repo root | **pass**: `vue-tsc --noEmit`, no errors |
| 4 | `pnpm test:unit` | repo root | **4 failed**, 733 passed (737 tests; 1 of 50 files failed) |
| 5 | `pnpm test:spec` (CommonMark 0.31 + GFM) | `packages/muya` | **pass**: 1347 tests, 4 files |
| 6 | `pnpm test` (Muya unit tests) | `packages/muya` | **pass**: 1444 tests, 212 files |

`--frozen-lockfile` was used instead of a bare `pnpm install` so the install could
not rewrite the hand-edited `pnpm-lock.yaml` (see `FORK_DELTA.md`, section G).
`pnpm check` is `pnpm lint && pnpm typecheck`; the halves were run separately to
record each exit code.

## The one pre-existing failure

`packages/desktop/test/unit/specs/export-settings-persist.spec.ts`: all 4 tests fail
with

```
TypeError: Cannot read properties of undefined (reading 'clear')
 ❯ test/unit/specs/export-settings-persist.spec.ts:15:18
     15|     localStorage.clear()
```

**Cause, verified:** this is Node 26, not the code under test. Node 25 and later
define their own global `localStorage`. Without `--localstorage-file` it evaluates
to `undefined`, and it takes precedence over the one jsdom would install.

Evidence:

- `node -e "console.log(typeof localStorage)"` prints `undefined` plus
  `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`.
- With Node's built-in web storage switched off, which is how Node 22 and 24
  behave, the same spec passes 4 of 4 and the whole suite passes:
  `NODE_OPTIONS=--no-experimental-webstorage pnpm test:unit` → **737 passed, 50 files**.

So on CI's Node versions this spec is expected to pass. That was **not** run here:
no Node 22 or 24 is installed on this machine.

The spec was not edited. It is a protected file, and commit `bcf3af7e` removed its
`// @vitest-environment happy-dom` line on purpose. The test is not wrong; it needs
either a Node version below 25 or the flag above.

**Reference baseline for later phases:** `NODE_OPTIONS=--no-experimental-webstorage pnpm test:unit`
= 737 passed. Without the flag, exactly these 4 failures are expected and no others.

## End-to-end baseline (added during Phase 0)

Run on a build of the untouched tree (commit `645c6971`, a separate git worktree),
with `pnpm build:unpack` then `pnpm exec playwright test test/e2e` in
`packages/desktop`:

**211 passed, 4 failed, 4 skipped** (59 spec files, 1.6 min).

The 4 failures are all in `test/e2e/export-pdf.spec.ts` and all the same error:

```
strict mode violation: locator('.print-settings-dialog .button-primary') resolved to 2 elements:
    1) <button class="button-primary">Preview</button>
    2) <button class="button-primary">Export...</button>
```

The spec predates the fork's Preview button (`FORK_DELTA.md`, section C), which
added a second primary button to the export dialog. The feature works; the
selector is stale. The spec was not edited: see Q5 in `PROGRESS.md`.

**The suite is noisy on this machine.** Beyond the four stable `export-pdf`
failures, a full run usually has zero to two more, and they move around. Six full
runs on 2026-11-16 and 17, alternating builds:

| Build | Extra failures (besides the four `export-pdf`) |
|---|---|
| untouched baseline | none |
| untouched baseline | `code-block-typing:55`, `find-replace:212` |
| untouched baseline | `find-replace:193`, `find-replace:212` |
| rebrand | `code-block-typing:55` |
| rebrand | `editor-input:48` |
| rebrand | none |

A seventh run, on the rebrand build with the load average above 20, failed
`fixture-render:24` and `parity-pg1-menu-state:125` instead. The one CI run (Linux,
PR #1) failed `editor-input:48`.

The typing failures all have the same shape: text typed with
`page.keyboard.type(text, { delay: 0 })` arrives without its last character. They
occur on the untouched baseline, so they are not caused by markDX changes.

What this means for later phases: a full e2e run is not a reliable regression
signal here. Each phase is checked with its own spec files and the specs for the
code it touched, run once, and a failure of the kinds above is not re-run to
prove a point.

## Not run at baseline

| Check | Why not |
|---|---|
| Muya Playwright suite (`packages/muya/e2e`) | needs its own dev server and browsers; will be baselined before the first phase that changes Muya |
| `pnpm lint` inside `packages/muya` and `packages/website` | those packages lint themselves and are excluded from the root config; not part of the requested baseline |
| `pnpm build`, platform packaging | not requested for the baseline; first needed in Phase 0 |
| `pnpm gen-third-party`, `pnpm validate-licenses` | first needed when a dependency is added |
