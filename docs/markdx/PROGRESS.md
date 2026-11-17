# markDX progress

Read this first after any context reset. Then read `FORK_DELTA.md` (what is
protected) and `BASELINE.md` (what "green" means here).

## Where things stand

| Phase | Status | Branch |
|---|---|---|
| Step 0: audit | **done** | `markdx/step-0-audit` |
| Phase 0: rebrand | **done**, pushed | `brand/markdx` |
| Phase 1: modes shell | in progress | `markdx/phase-1-modes` |
| Phase 2: Marp decks | not started | `markdx/phase-2-marp` |
| Phase 3: notebooks | not started, **blocked on Q1** | `markdx/phase-3-notebooks` |
| Phase 4: Zotero | not started, **blocked on Q1** | `markdx/phase-4-zotero` |
| Phase 5: brand, UI, marketing | not started | `markdx/phase-5-brand` |

## Standing requirements added by the owner

**R1. Screen-reader accessible (2026-11-16).** Beyond the keyboard and contrast
pass the brief already asked for:

- Every new markDX control ships with a semantic role, an accessible name, full
  keyboard operation, a visible focus indicator, and a live-region announcement
  when it changes something the user cannot see (mode switched, cell finished,
  slide changed, citation inserted).
- New e2e tests assert on roles and names, not only on CSS classes.
- Phase 5 audits the chrome that already exists (title bar, tabs, sidebar, format
  toolbar, dialogs) with VoiceOver and an automated checker, and fixes what it
  finds. The format toolbar is protected (`FORK_DELTA.md`, D): its buttons are
  glyphs with only a `title`, so the fix there is additive `aria-label`s.
- Not promised: the Muya editing surface itself is one large `contenteditable`.
  Its screen-reader behaviour will be measured in Phase 5 and reported honestly
  rather than assumed to be fixable in one pass.

**R2. No pull requests (2026-11-17).** "Don't put PRs, just push them. This is my
fork of the repo, not the official marktext." Each phase branch is pushed to the
`fork` remote and that is all. This replaces "one PR per phase" in the brief. PR #1
(Phase 0) was opened before this and is left as it is until the owner says
otherwise.

## Done

- **Step 0.** Remotes, branches and history audited; the five fork commits read in
  full; `FORK_DELTA.md` and `BASELINE.md` written.
- **Phase 0.** The app launches as markDX.
  - `brand/markdx-icon.svg` and `scripts/markdx-icons.ts`: all app icons regenerated
    (PNG 16 to 1024, `.ico`, `.icns`).
  - `scripts/markdx-rebrand.ts`: dry run by default, `--apply` to write, second run
    is a no-op. 186 replacements in 25 files; comments and identifiers left alone.
  - `MARKDX_*` variables mirror onto `MARKTEXT_*`; the new name wins.
  - One-time copy of settings from the MarkText user-data folder. Preferences this
    build's schema rejects are dropped, so a profile from a newer MarkText cannot
    stop the app from starting.
  - An independent review found no blockers and three issues worth fixing, all
    fixed: the startup failure above, `.deb`/`.rpm` packages still named
    `marktext`, and symlinked settings being copied as links.
  - Protected files touched: `static/locales/en.json` (13 values, word swap only;
    the fork's own keys untouched) and `packages/desktop/package.json` (description,
    plus one added `productName` line).

## Next

Phase 2 (Marp decks), on `markdx/phase-2-marp` cut from `markdx/phase-1-modes`.
Built as slices that each work on their own, in this order:

1. **Engine.** `@marp-team/marp-core` 4.4.0 (MIT) behind one function:
   Markdown in, per-slide HTML, CSS and speaker notes out, raw HTML off. Measured
   with the copy inside the installed Marp CLI: `render(md, { htmlAsArray: true })`
   returns `{ html[], css, comments[][] }`, and a 40-slide deck renders in about
   16 ms warm, so the 150 ms target leaves room for the DOM update.
2. **Preview.** One sandboxed iframe (scripts allowed, opaque origin, no
   same-origin) holding the filmstrip and the slide canvas, fed by `postMessage`
   and patched slide by slide. Open questions to settle with a single probe run:
   whether a sandboxed `srcdoc` frame may load the frame script and local images
   when the renderer is served from `file://`, and how the renderer's inherited
   CSP (`script-src 'self'`) treats it.
3. **Slide boundaries in the editor.** CSS only, keyed on `body[data-markdx-mode]`
   plus a flag for `marp: true`; no Muya change.
4. **Themes.** default, gaia, uncover from marp-core; "Paper" and "Ink" as new CSS
   files; user themes from a folder.
5. **Directive inspector.** Edits front matter, so it is the one place in this
   phase that changes text, and it must do so through the editor so undo works.
6. **Presenter window.** New window, typed IPC, current and next slide, notes,
   timer.
7. **Export.** HTML, PDF (`printToPDF` at the deck size), PNG per slide, PPTX as
   images. PPTX is a zip of PNGs and fixed XML: written by hand with stored
   (uncompressed) entries, so no new dependency.
8. **Checks.** Visual diff against Marp CLI for the built-in themes (opt-in: it
   needs the CLI and a browser), and a timing test for the 40-slide deck.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | `origin` is treated as upstream; no `upstream` remote added. | `origin` already points at `marktext/marktext`. |
| D2 | Push only to the `fork` remote. Every `gh` command passes `--repo Koala-123/markD`. No pull requests (R2). | `origin` is upstream. A bare `gh pr create` could open a pull request against MarkText itself. |
| D3 | Fork delta is measured against `origin/develop` at `e52106fd`. | `master` is frozen at v0.19.0. |
| D4 | markDX branches are cut from `fix/math-recognition-and-export-compat`, stacked one on the next. | `fork/develop` contains none of the fork's five commits, so cutting from it would drop protected work. Stacking keeps each branch to one phase. |
| D5 | pnpm 10.33.4 is run from a temporary folder; installs use `--frozen-lockfile`. | pnpm is not on `PATH`; the lockfile was hand-edited and must not be re-resolved. |
| D6 | Unit tests are compared with `NODE_OPTIONS=--no-experimental-webstorage`. | Node 26 breaks one protected spec for reasons unrelated to the code. See `BASELINE.md`. |
| D7 | Work proceeds on the current base (upstream as of `e52106fd`). No upstream merge. | A merge would rewrite protected files. That is the owner's call: see Q1. |
| D8 | The app name is set with `"productName": "markDX"` in `packages/desktop/package.json`. | Electron prefers it over `name`, in dev and packaged builds alike, so the package can stay `marktext` (an identifier) while the user-data folder becomes `markDX`. |
| D9 | The product name is decided in one place: `scripts/markdx-rebrand.ts`. | A later rename is two constants and a re-run. It also lets the rename be replayed on a new base if Q1 is answered "sync first". |
| D10 | The settings migration copies `preferences.json`, `keybindings.json`, `recently-used-documents.json` and `themes/` only. | `dataCenter.json` stores absolute paths into the old folder; copying it would make markDX save pasted images into MarkText's folder. Caches are not safe to copy. |
| D11 | The rename also covers the `description` values in `src/main/preferences/schema.json`, although the brief lists only `.ts`, `.vue` and `index.html`. | They are the fallback text shown by the preferences search box, so they are user-visible. |
| D12 | Repository, help, sponsor and documentation URLs were left pointing at MarkText. | The brief says not to rename repository URLs. The consequences are in Q4. |
| D13 | The migration code under `src/main/markdx/` is excluded from the rename script. | It names the old app on purpose. |
| D14 | The migration runs after the command line is parsed, and only when no `--user-data-dir` is in effect. | Dev mode and portable mode pick their profile inside `cli()`, not on the command line. One source of truth. |
| D15 | Migrated preferences are checked key by key against a scratch electron-store that uses the real schema; rejected keys are dropped. | Upstream's newer schema allows values this build rejects, and one rejected value makes electron-store throw at startup. Using the real loader as the judge needs no new dependency. |
| D16 | The migration makes exactly one attempt (the marker is written before copying) and copies symlinks as real files. | A retry would run against a profile the app has since filled with defaults. A recreated symlink would leave both apps writing one file. |
| D17 | `deb.packageName` and `rpm.packageName` are set to `markdx` in `electron-builder.yml`. | fpm names packages after `package.json` `name`, which stays `marktext`; a markDX package would otherwise replace an installed MarkText. |

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

**Q3. Real `appId`.** Phase 0 uses the placeholder `com.markdx.app` (in
`electron-builder.yml`, the Windows AppUserModelID and the Linux appdata id). The
owner needs to choose the real one before any signed or published build.

**Q4. Links and updates still point at MarkText.** Left alone because the brief
says not to rename repository URLs, but three of them now mislead:

- "Support markDX" in the Help menu opens MarkText's sponsor page.
- "Report issue", "Discussions" and the documentation links send markDX users to
  MarkText's maintainers.
- The crash dialog's Report button opens a new issue on MarkText's tracker.
- "Check for Updates" uses `electron-updater`. If a build is ever published with
  the upstream `repository` field, markDX could offer MarkText releases as its own
  updates. Its download cache folder is also still named `marktext-updater`.
- The Linux appdata file keeps MarkText's homepage, bug tracker, screenshots and
  release history.

Recommended: point Help and issue links at the fork, and hide "Check for Updates"
until markDX has its own release feed. Needs the owner's URLs.

**Q5. A protected e2e spec is out of date.** `test/e2e/export-pdf.spec.ts` fails 4
tests at baseline. Its selector `.print-settings-dialog .button-primary` now
matches two buttons, Preview and Export, since the fork added Preview. The test is
plainly stale rather than the feature broken. Not edited. Recommended one-line fix:
select the Export button by its text or as the last `.button-primary`.

## Things to remember

- **CI on the fork runs only on pull requests** (`lint`, `test`, `e2e`, licence
  validation, and packaging builds for Linux, macOS and Windows). With no PRs (R2)
  nothing runs automatically, so every check is run locally. The one CI run that
  exists, on PR #1, showed: lint, unit tests (Node 22.21.1, 51 files) and licence
  validation pass, and all five packaging builds succeed. That is the only
  evidence that the Windows and Linux packaging changes build.

- The fork is public. Anything pushed is visible.
- `CLAUDE.md` is stale in places (website stack, marked version). Trust the code.
- Never run `pnpm format`, `eslint --fix` or any formatter across the repo.
- Launching the app creates `~/Library/Application Support/markDX`. Electron does
  that itself before any app code runs, even with `--user-data-dir`. Test launches
  use a temporary profile, and the migration is tested against a fake home folder
  (`CFFIXED_USER_HOME`), never the real one.
- Linux and Windows packaging changes (desktop entry, NSIS script, `.ico`,
  `.deb`/`.rpm` names) have not been run on those systems. The macOS bundle has:
  `electron-builder --mac --dir` produces `markDX.app` and it launches.
- After pulling a branch that changes locale files, run `pnpm minify-locales`.
  Dev builds read the git-ignored `*.min.json`, so stale ones still say MarkText
  in the application menu.
- Running e2e and then lint fails lint on `packages/desktop/test-results/.last-run.json`:
  the root ESLint config ignores `test-results/` only at the repo root. Delete the
  folder before linting. (`eslint.config.js` is protected; not changed.)
