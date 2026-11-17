# markDX progress

Read this first after any context reset. Then read `FORK_DELTA.md` (what is
protected) and `BASELINE.md` (what "green" means here).

## Where things stand

| Phase | Status | Branch |
|---|---|---|
| Step 0: audit | **done** | `markdx/step-0-audit` |
| Phase 0: rebrand | **done**, pushed | `brand/markdx` |
| Phase 1: modes shell | **done**, pushed | `markdx/phase-1-modes` |
| Phase 2: Marp decks | **done except the items in "Phase 2 not finished"**, pushed | `markdx/phase-2-marp` |
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
(Phase 0) was opened before this; the owner asked for it to be removed, so it was
closed on 2026-11-17 (GitHub does not allow deleting a pull request).

**R3. "This is not marktext anymore" (2026-11-17).** The owner asked for the README
and everything that calls the product MarkText to say markDX. Done with
`scripts/markdx-rebrand.ts` (prose rule) and a rewritten README. The capitalised
name is kept only where it states a fact about upstream: the `LICENSE` copyright,
changelogs, third-party licences, `docs/markdx/`, the README credit line, and a few
comments and website lines about MarkText's history, each marked
`keep-upstream-name`. Lowercase identifiers and upstream URLs are unchanged.

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

## Phase 1 known limits (from review, not fixed)

- Tab does not reach the switch from the editor (Muya keeps Tab for indenting).
  The keyboard route is the palette: "Mode: Doc / Deck / Notebook".
- With the native title bar on Windows or Linux there is no visible switch, only
  the palette. A View-menu entry would fix it.
- Narrow windows (under about 700 px) can squeeze the file name out of the title
  bar; on macOS a four-digit word count may sit under the switch. Not measured.
- Detection reads front matter line by line, not as YAML: first duplicate key
  wins, multi-line quoted values can be misread.

## Phase 2 (Marp decks): what exists

"WYSIWYG slide deck" (owner, 2026-11-17) is met this way: in Deck mode the Muya
editor stays on the left and edits the slides' Markdown as before; on the right
the exact slides, drawn by marp-core, update as you type. The caret picks the
slide, a thumbnail moves the caret, and each `---` is a numbered slide boundary
in the editor. **Not built: typing directly on the drawn slide.** That needs a
mapping from slide DOM back to Markdown offsets and was judged a much larger
design than the owner's brief priced; say if you want it.

- Engine `markdx/deck/render.ts`: marp-core 4.4.0 pinned, raw HTML escaped, no
  script, remote `@import`s stripped (gaia and uncover import web fonts; markDX
  makes no request just from opening a deck).
- Preview `components/deckPane`: current slide, filmstrip, notes, each slide in an
  `<iframe sandbox="">` (no flags: no script, opaque origin) with its own CSP.
- Themes: default, gaia, uncover from marp-core; **Paper** and **Ink** are
  original markDX themes (`markdx/deck/themes.ts`, system fonts only).
- Directive inspector: theme, size (16:9, 4:3), page numbers. Edits front matter
  through `replaceContent`, so each change is one undo step (e2e checks undo).
- Presenter window: current slide, next slide, notes, timer, keys, full screen.
  Its only script has a CSP nonce; deck data is a JSON block.
- Export (main process, `mt::markdx-export-deck`): HTML, PDF (one page per
  slide, tagged), PNG per slide, PPTX (each slide a picture with the slide title
  as alt text; the zip is written by hand, so no new dependency).
- Commands: "Deck: Open presenter view" and four "Deck: Export ..." in the palette.
- Accessibility (R1): region and list roles with names, buttons with names
  ("Go to slide 2: Title"), `aria-current`, live regions for slide changes,
  settings changes and export results, visible focus, forced-colors rules; the
  presenter has a timer role, live status and labelled regions. e2e queries by
  role and name.

### Measured (this machine, macOS, Electron 42; one run each, not a benchmark suite)

- Engine alone, 40 slides, warm: about 6 to 16 ms (unit test asserts under 150 ms).
- Keystroke to updated slide on a 40-slide deck, in the real app: 116 ms
  (`markdx-deck-timing.spec.ts`, includes the 60 ms debounce). Target was 150 ms.
- Visual diff against Marp CLI (opt-in e2e, `MARKDX_MARP_CLI=$(which marp)`),
  share of pixels differing by more than 32/255 in any channel, 3 slides per theme:

  | Theme | Slide 1 | Slide 2 | Slide 3 |
  |---|---|---|---|
  | default | 0.346% | 0.120% | 0.298% |
  | gaia | 2.021% | 1.179% | 0.194% |
  | uncover | 0.421% | 0.105% | 0.523% |
  | paper | 0.322% | 0.088% | 0.173% |
  | ink | 1.224% | 0.547% | 0.290% |

  The test allows 2% (8% for gaia and uncover, whose web fonts the CLI downloads
  and markDX does not). gaia's 2.02% on slide 1 is that font difference, not a
  rendering bug, but it is an inference: it was not re-measured with the font
  bundled. ink's 1.2% was not investigated.

### Phase 2 not finished

- **User themes from a folder** (brief item): not built.
- **Typing directly on the slide** (see above).
- **Audience window** kept in step with the presenter: not built; the presenter's
  slide area can be taken full screen with F.
- **Bundled fonts** for gaia and uncover (Lato, Roboto Mono, OFL): not done.
- Exported PPTX was opened with python-pptx and unzip, **not with PowerPoint,
  Keynote or LibreOffice**. Slides are pictures; text is not editable there.
- HTML export is a scrolling page, no slide-by-slide keyboard navigation.
- Relative image paths in the preview (`<base href="file://...">` in a sandboxed
  frame) are built but **not tested**.
- Only macOS was run. Windows and Linux paths (hidden windows, file URLs with
  drive letters) are untested.
- The presenter was not tried on a second display. English strings only for the
  new text (other locales fall back to English).
- Muya's own selection and `.mu-thematic-break` structure are relied on for the
  caret and slide boundaries; a Muya change to that class name breaks both.

## Next

Phase 3 and 4 wait on Q1. Phase 5 (brand, UI, marketing) does not.

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
| D18 | Deck frames are `<iframe sandbox="">` with no flags and a meta CSP; no script and no `postMessage`. | The slide is only markup, so nothing in a document can run. The cost: thumbnails are buttons laid over frames, and updates replace `srcdoc`. |
| D19 | Directive edits go through `muya.replaceContent` via a `markdx:replace-markdown` bus event (8 lines added to `editor.vue`). | The only existing path that records one undo step for a text change. |
| D20 | One hidden window serves a whole export. | A window per slide made capture fail with `UnknownVizError` after a few exports in one session (seen in testing). |
| D21 | PNG-decoding for the visual diff happens in the page (canvas), not with `nativeImage`. | `nativeImage` decoding took the app down on one slide. |

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
