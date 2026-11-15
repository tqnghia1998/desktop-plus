# Theme sites

Every place where one of the 26 palette primitives (13 per mode) appears as a literal
hex value in this fork, and the role it plays. Space App Vibing's palette script rewrites
old to new hex literals at exactly these sites; nothing else in the fork restates a
palette colour, and `web-server/test-ui-ownership.js` fails if a hex appears outside the
two primitive blocks of `app/src/patches/vibing/appearance.css`.

Each mode declares the same 13 roles, bound once as `--vibing-*` variables:
canvas (`--vibing-surface`), raised, hover, selected, border, faint/subdued/default text
(`--vibing-text-faint`, `--vibing-text-subdued`, `--vibing-text`), blue, green, yellow,
red and purple. The shared role block binds every Desktop Plus variable to them, with the
same mapping in both modes (see `web-server/FORK-OVERLAY.md`).

## Owned sites (rewrite these)

### `app/src/patches/vibing/appearance.css`: the only place a primitive is declared

The primitive blocks are `body.theme-dark` and `body.theme-light`. Each hex appears once.

| Role | Variable | Dark | Light |
| --- | --- | --- | --- |
| canvas | `--vibing-surface` | `#1d2125` (line 74) | `#d6d8df` (line 92) |
| raised | `--vibing-raised` | `#24292e` (line 75) | `#dddfe5` (line 93) |
| hover | `--vibing-hover` | `#2f363d` (line 76) | `#e3e4ea` (line 94) |
| selected | `--vibing-selected` | `#444d56` (line 77) | `#c6c9cf` (line 95) |
| faint text | `--vibing-text-faint` | `#959da5` (line 79) | `#686a77` (line 97) |
| subdued text | `--vibing-text-subdued` | `#d1d5da` (line 80) | `#4c505e` (line 98) |
| default text | `--vibing-text` | `#f6f8fa` (line 81) | `#343b59` (line 99) |
| border | `--vibing-border` | `#2b3137` (line 78) | `#c1c2c7` (line 96) |
| blue | `--vibing-blue` | `#79b8ff` (line 82) | `#395d99` (line 100) |
| green | `--vibing-green` | `#28a745` (line 83) | `#33635c` (line 101) |
| yellow | `--vibing-yellow` | `#f9c513` (line 84) | `#7e5211` (line 102) |
| red | `--vibing-red` | `#f97583` (line 85) | `#8c4351` (line 103) |
| purple | `--vibing-purple` | `#b392f0` (line 86) | `#7540b1` (line 104) |

### `web-server/test-ui-ownership.js`: pinned copy of the stylesheet

The ownership guard pins the exact browser base plus `appearance.css` text in one template
literal, so it repeats the same 26 declarations. After rewriting `appearance.css`, update
the same hex there (or regenerate the literal: it is `browser-renderer.css`, a blank line,
then `appearance.css`, verbatim).

| Role | Dark | Light |
| --- | --- | --- |
| canvas | `#1d2125` (line 191) | `#d6d8df` (line 209) |
| raised | `#24292e` (line 192) | `#dddfe5` (line 210) |
| hover | `#2f363d` (line 193) | `#e3e4ea` (line 211) |
| selected | `#444d56` (line 194) | `#c6c9cf` (line 212) |
| faint text | `#959da5` (line 196) | `#686a77` (line 214) |
| subdued text | `#d1d5da` (line 197) | `#4c505e` (line 215) |
| default text | `#f6f8fa` (line 198) | `#343b59` (line 216) |
| border | `#2b3137` (line 195) | `#c1c2c7` (line 213) |
| blue | `#79b8ff` (line 199) | `#395d99` (line 217) |
| green | `#28a745` (line 200) | `#33635c` (line 218) |
| yellow | `#f9c513` (line 201) | `#7e5211` (line 219) |
| red | `#f97583` (line 202) | `#8c4351` (line 220) |
| purple | `#b392f0` (line 203) | `#7540b1` (line 221) |

The same file also lists the 13 primitive names (not values) in the alignment guard; it holds no hex.

## Documentation

`web-server/FORK-OVERLAY.md` refers to `appearance.css` and Space App Vibing's `docs/theme.md`
instead of restating values. This file's own tables repeat the values and are the only prose
that does; update them (hex and line numbers) when the palette changes.

## Coincidental matches (do not rewrite)

Upstream Desktop Plus code that happens to use the same hex as a primitive. These are not
palette sites: they belong to upstream's own GitHub palette or to non-themed assets.

| File | Line | Value | Why it is not a palette site |
| --- | --- | --- | --- |
| `app/src/main-process/app-window.ts` | 97 | `#24292e` | Electron desktop window background (desktop app only, not the web port) |
| `app/src/ui/diff/diff-minimap.tsx` | 1611 | `#f6f8fa` | JS fallback when `--box-alt-background-color` is unset; the variable is always set |
| `app/styles/_variables.scss` | 465 | `#24292e` | upstream light `:root` `--syntax-alt-variable-color`, overridden by the role block |
| `app/styles/_variables.scss` | 567 | `#f6f8fa` | upstream light `:root` `--md-canvas-subtle-color`, overridden by the role block |
| `app/styles/ui/history/_commit-graph.scss` | 275 | `#24292e` | upstream commit graph label colour |
| `app/styles/ui/history/_expandable-commit-summary.scss` | 259 | `#959da5` | upstream summary tint (`rgba(#959da5, 0.1)`) |
| `app/static/common/*.svg` | n/a | assorted | Illustration artwork, not themed |
