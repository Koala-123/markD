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

## Not run at baseline

| Check | Why not |
|---|---|
| `pnpm test:e2e` (desktop Playwright, 59 spec files) | needs a build and opens Electron windows; will be baselined before the first phase that adds e2e tests |
| Muya Playwright suite (`packages/muya/e2e`) | same |
| `pnpm lint` inside `packages/muya` and `packages/website` | those packages lint themselves and are excluded from the root config; not part of the requested baseline |
| `pnpm build`, platform packaging | not requested for the baseline; first needed in Phase 0 |
| `pnpm gen-third-party`, `pnpm validate-licenses` | first needed when a dependency is added |
