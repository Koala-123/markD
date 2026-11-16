# Fork delta: what this fork changed relative to upstream MarkText

Audited 2026-11-16 on branch `fix/math-recognition-and-export-compat` at `bcf3af7e`.

Everything in this file is **PROTECTED**: it is not to be reverted, overwritten,
reformatted or "tidied". Where a markDX phase has to touch one of these files, the
edit must be small and additive, and must be listed in that phase's report.

Each "Intent" line below is **an inference** from the diff and commit message, not
something the author confirmed.

## How the delta was measured

| Fact | Value |
|---|---|
| Upstream remote | `origin` → `https://github.com/marktext/marktext` |
| Fork remote | `fork` → `https://github.com/Koala-123/markD` (public, default branch `develop`) |
| Upstream base branch | `origin/develop` (not `master`, see below) |
| Merge base | `e52106fd` "docs: update sponsor logo (#5014)" |
| Fork commits on top | 5 (`git log e52106fd..HEAD`) |
| Size | 429 files, +600 / −47,931 (of which 391 files / −47,580 are the deleted `packages/muyajs`) |
| Outside `packages/muyajs` | 38 files, +600 / −351 |

Commands used: `git merge-base HEAD origin/develop`, `git log e52106fd..HEAD`,
`git diff --stat e52106fd..HEAD`, and `git show` on each commit.

### Where the repo disagrees with the brief

- **No `upstream` remote was added.** The brief says to add one if missing, but
  `origin` already *is* upstream MarkText and the fork is the `fork` remote. A
  second remote for the same URL would only duplicate about 100 remote branches.
- **The base is `develop`, not `master`.** `origin/master` is frozen at v0.19.0.
  Measuring against it reports 348 upstream commits as fork changes.
- **`AGENTS.md` does not exist in this fork.** The equivalents are `CLAUDE.md` and
  `packages/muya/CLAUDE.md` (both read). Upstream has since renamed them to
  `AGENTS.md`.
- **The fork's default branch (`fork/develop`) has none of the fork's work.** It
  sits exactly at the merge base. All five commits live only on
  `fix/math-recognition-and-export-compat`, so markDX branches are cut from that
  branch, not from the default branch.
- `CLAUDE.md` describes the website as Vite + React 18 and Muya as using
  `marked@16`. The code has Next.js 15 + React 19 and `marked@^18`. Trust the code.

## The five commits

| Commit | Date | Subject |
|---|---|---|
| `9aa81609` | 2026-08-29 | fix: math expression recognition and PDF/HTML export compatibility |
| `08a481be` | 2026-11-12 | refactor: remove the legacy packages/muyajs engine |
| `262fa6cc` | 2026-11-12 | fix(muya): stop currency-like $ spans from mis-pairing with later math |
| `a745519b` | 2026-11-12 | fix(desktop): harden PicGo upload and debug panel, fix preferences listener |
| `bcf3af7e` | 2026-11-12 | feat(desktop): print preview, format toolbar and print page-break tuning |

## Changes grouped by feature

### A. Math recognition (`$…$`, `$$…$$`, currency) — PROTECTED

Commits `9aa81609`, `262fa6cc`.

| File | Change |
|---|---|
| `packages/muya/src/inlineRenderer/rules.ts` | `inline_math` accepts one or two `$`; closing lookahead is `(?![0-9$])`; new exported `inlineMathNaive` |
| `packages/muya/src/inlineRenderer/lexer.ts` | `tryChunks` consumes a rejected `$…$` span as one literal run |
| `packages/muya/src/inlineRenderer/renderer/inlineMath.ts` | `$$` renders in display mode; offsets use the marker length |
| `packages/muya/src/block/base/format.ts` | `getOffset` uses the token's real marker length |
| `packages/muya/src/utils/marked/extensions/math.ts` | export tokenizer: `start()` scans all candidates; single-line `$$…$$` blocks; inline rule aligned with the editing rule |
| `packages/muya/src/inlineRenderer/__tests__/inlineMathEscape.spec.ts` | tests added |
| `packages/muya/src/state/__tests__/mathTrailingSpace.spec.ts` | tests added |

Intent (inference): make `$$x$$` work inline, stop prices such as `$5` from being
read as math, and keep the editor and the export path agreeing on what is math.
The comments say the regexes are hand-tuned and must not be rewritten to please
the linter.

**markDX contact:** Phase 4 adds a `citation` inline token to these same rule and
lexer files. That edit must be additive and must not change `inline_math`,
`inlineMathNaive` or the `tryChunks` fallback.

### B. PDF / HTML export correctness and page breaks — PROTECTED

Commits `9aa81609`, `bcf3af7e`.

| File | Change |
|---|---|
| `packages/desktop/src/renderer/src/services/printService.ts` | parses a full HTML document, injects its `<head>` styles into the live page, uses only `<body>` for the print container; `clearup()` removes injected styles |
| `packages/desktop/src/renderer/src/util/exportHtml.ts` | function replacers so `$$`, `$1`, `$&` in content are not treated as replacement tokens; header/footer cell width `100vw` → `100%` |
| `packages/desktop/src/renderer/src/util/pdf.ts` | print CSS: `break-inside: avoid` for rows, figures, images, blockquotes, math, diagrams; `table` and `pre` deliberately *not* included |
| `packages/muya/src/assets/styles/exportStyle.css` | matching `@media print` rules |
| `packages/desktop/test/unit/specs/exportHtml.spec.ts` | tests added |
| `packages/desktop/test/unit/specs/pdf.spec.ts` | tests updated |
| `packages/desktop/vitest.config.ts` | `testTimeout: 15000` |

Intent (inference): stop PDF export from repeating content or printing `<style>`
text, stop math and currency being mangled on export, and stop page breaks slicing
through rows, figures and math without stranding blank pages before tall tables.

**markDX contact:** Phase 2 deck export (PDF, PNG, PPTX) goes through new files and
its own print path. It does not reuse or modify `printService.ts` or `pdf.ts`.

### C. Print preview — PROTECTED

Commit `bcf3af7e`.

| File | Change |
|---|---|
| `packages/desktop/src/renderer/src/components/printPreview/index.vue` | **new**: dialog showing the export HTML in an `<iframe sandbox="">` |
| `packages/desktop/src/renderer/src/components/exportSettings/index.vue` | Preview button; `buildOptions()` extracted |
| `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue` | `handleExportPreview`, `export-preview` bus event; `printer?.clearup()` |
| `packages/desktop/src/renderer/src/pages/app.vue` | mounts `<print-preview />` |
| `packages/desktop/static/locales/en.json` | `exportSettings.preview`, `editor.printPreview.*` |

Intent (inference): let the user see the styled output before printing or saving a
PDF, with a script-blocking iframe as a second layer behind DOMPurify.

### D. Format toolbar — PROTECTED

Commit `bcf3af7e`.

| File | Change |
|---|---|
| `packages/desktop/src/renderer/src/components/formatToolbar/index.vue` | **new**: headings, lists, quote, code, bold/italic/strike, link, image, table, rule, print |
| `packages/desktop/src/renderer/src/components/editorWithTabs/index.vue` | mounts it above the editor, hidden in source-code mode |
| `packages/desktop/static/locales/en.json` | `editor.toolbar.*` |

Intent (inference): a visible toolbar for people who do not use the menu or
shortcuts. It owns no logic; it re-emits the bus events the application menu sends.

**markDX contact:** the Phase 1 mode switch goes in the title bar, not here. The
Phase 5 "chrome fades while typing" work may restyle how the toolbar appears, but
must keep it and its buttons.

### E. Security hardening — PROTECTED

Commit `a745519b`.

| File | Change |
|---|---|
| `packages/desktop/src/main/ipc/uploader.ts` | PicGo runs via `execFile` with an argv array instead of a shell string |
| `packages/desktop/src/renderer/src/prefComponents/sideBar/config.ts` | `escapeHTML` on values interpolated into the debug panel's `innerHTML` |
| `packages/desktop/src/renderer/src/prefComponents/sideBar/index.vue` | unsubscribes its own `settings::change-tab` listener instead of `removeAllListeners` |
| `packages/desktop/src/renderer/src/i18n/index.ts` | stray `console.log` removed |

Intent (inference): close a command-injection path through image file names, close
an HTML-injection path in a debug panel, and fix a listener that removed other
components' handlers.

### F. Test-environment robustness — PROTECTED

Commit `bcf3af7e`.

| File | Change |
|---|---|
| `packages/desktop/src/renderer/src/store/layout.ts` | `localStorage` access guarded so importing the store cannot throw |
| `packages/desktop/test/unit/specs/export-settings-persist.spec.ts` | `// @vitest-environment happy-dom` directive removed |

Intent (inference): `happy-dom` is not a declared dependency, so the spec was moved
to the default jsdom environment. See `BASELINE.md`: under Node 26 this spec now
fails, for a reason that is about Node rather than about the test.

### G. Removal of the legacy `packages/muyajs` engine — PROTECTED

Commit `08a481be`.

| File | Change |
|---|---|
| `packages/muyajs/**` | deleted (391 files) |
| `packages/desktop/src/types/muya.d.ts` | deleted |
| `packages/desktop/src/types/muya-core.d.ts` | comment updated |
| `packages/desktop/electron.vite.config.ts`, `vitest.config.ts`, `tsconfig.base.json`, `tsconfig.json` | `muya` alias removed |
| `packages/desktop/package.json` | `@marktext/muyajs` dependency removed |
| `eslint.config.js` | muyajs-only blocks removed |
| `scripts/thirdPartyChecker.ts` | muyajs exclusion removed |
| `pnpm-lock.yaml` | muyajs importer pruned by hand |
| `CLAUDE.md`, `packages/muya/CLAUDE.md` | legacy-engine text removed; sandbox description corrected |

Intent (inference): nothing imported the old JavaScript engine any more, so the
dead code and its wiring were removed. The lockfile was edited by hand on purpose,
to avoid re-resolving a git-hosted dependency.

**markDX contact:** `pnpm-lock.yaml` will change when Phases 2 to 4 add
dependencies. That is done with `pnpm add` on the specific package only, and the
lockfile diff is checked so unrelated entries are not re-resolved.

## Protected files that markDX phases are expected to touch

| File | Phase | Why | Rule |
|---|---|---|---|
| `packages/desktop/static/locales/en.json` | 0, 1+ | rename the visible word `MarkText`; add new keys | values only; the keys in C and D stay as they are |
| `packages/desktop/src/renderer/src/pages/app.vue` | 1+ | mount new top-level components | one import and one tag per component |
| `packages/desktop/src/renderer/src/components/editorWithTabs/index.vue` | 1, 2 | show the deck or notebook view beside the editor | additive; `<format-toolbar>` stays |
| `packages/muya/src/inlineRenderer/rules.ts`, `lexer.ts` | 4 | `citation` inline token | additive; math rules untouched |
| `packages/desktop/package.json`, `pnpm-lock.yaml` | 2, 3, 4 | new dependencies | targeted `pnpm add` only |
| `packages/desktop/vitest.config.ts` | maybe | only if a new alias is unavoidable | ask first |

## Upstream has moved on (not acted on)

After `git fetch --all` on 2026-11-16, `origin/develop` is **430 commits ahead** of
the merge base (`0.24.0-dev` against this fork's `0.20.0-dev`). Upstream has also
deleted `packages/muyajs`.

A trial merge done in memory (`git merge-tree --write-tree HEAD origin/develop`,
which touches no branch and no file) reports **20 conflicts**. The ones that matter:

- `packages/muya/src/inlineRenderer/rules.ts`, `lexer.ts` and
  `renderer/inlineMath.ts` are **deleted upstream** and modified here. Upstream has
  restructured Muya's inline renderer, so feature A cannot be merged mechanically;
  it would have to be re-applied to the new structure.
- Content conflicts in `math.ts`, `format.ts`, `printService.ts`, `exportHtml.ts`,
  `layout.ts`, `uploader.ts`, both preferences sidebar files, `en.json`,
  `vitest.config.ts`, `tsconfig.base.json`, `package.json`, `eslint.config.js`,
  `pnpm-lock.yaml`.

No merge was performed. Whether and when to sync is recorded as an open question
in `PROGRESS.md`.
