# Page Toolkit

26-tool frontend analysis toolkit for autonomous page inspection via Playwright. Analyzes color, layout, typography, touch interaction, and accessibility.

## Architecture

- **Source**: `src/` — modular files, plain functions sharing a single IIFE scope
- **Build**: `./build.sh` — `cat` in dependency order → `toolkit.js`
- **Output**: `toolkit.js` — the built artifact, injected via `addInitScript()`
- **No bundler, no imports** — files reference each other by function name after concat

### After editing source files

Always rebuild: `./build.sh`

### Source file convention

Each file contains bare functions — no closures, no `window` assignments, no namespace hacks. They share scope because `build.sh` concatenates them inside an IIFE (`header.js` opens it, `footer.js` closes it, `register.js` exposes `window.__ps`).

### Consumer pattern

```js
await page.context().addInitScript({ path: '/home/eric/page-toolkit/toolkit.js' });
await page.goto('https://example.com');
const palette = await page.evaluate(() => __ps.paletteProfile());
```

## Source modules

| Directory | Files | Purpose |
|-----------|-------|---------|
| `src/utils/` | color-math, oklch, harmony, dom, layout, easing | Shared utilities (color science, DOM traversal, box model) |
| `src/tools/` | 19 tool files | Individual analysis tools |
| `src/` | header, register, footer | IIFE wrapper + `window.__ps` export |

## Browse skill layering

| Location | Purpose |
|----------|---------|
| `.claude/commands/browse.md` | Generic: bootstrap, workflow phases, scoping rules |
| `~/.claude/commands/browse.md` | Symlink → this project's browse.md (global default) |
| Project `.claude/commands/browse.md` | Extends generic + adds project-specific auth/selectors |

## Key docs

- `docs/api-reference.md` — tool signatures, params, return types
