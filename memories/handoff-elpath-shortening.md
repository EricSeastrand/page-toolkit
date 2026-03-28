# Handoff: elPath() Shortening

## What and why

Continuing signal/noise improvement series. Batches 1-5 are complete and committed. The last remaining high-impact recommendation from `docs/signal-noise-recommendations.md` is **#8: shorten element paths globally**.

`elPath()` in `src/utils/dom.js` generates DOM paths used by nearly every tool. Current output looks like:
```
html > body > main > section.hero > div.container > div.card > a
```

This is 15+ tokens per path and appears hundreds of times across tool outputs. The recommendation is to trim to the last 2-3 ancestors, anchoring on `#id` if available:
```
section.hero > div.card > a
#main-nav > ul > li
```

## What's done

- Batches 1-5 all committed (see `threads/signal-noise.md` for full history)
- All other recommendations from the audit doc are implemented
- 113 tests passing

## What to do next

1. **Read `src/utils/dom.js`** — find the `elPath()` function
2. **Change the algorithm:**
   - Walk up from target element
   - Stop at `#id` ancestor (use it as anchor) OR after 3 ancestors, whichever comes first
   - If element itself has an id, just return `tag#id`
   - Keep the `tag.class1.class2` format for each segment
   - Cap classes at 2 per segment (already done, but verify)
3. **Rebuild:** `./build.sh`
4. **Run tests:** `npx playwright test` — many tests check path strings, expect some to need updating
5. **Measure impact:** `node test/measure-reduction.js` — paths affect every tool, so siteProfile total should drop noticeably

## Key considerations

- This is a cross-cutting change — every tool that calls `elPath()` is affected
- The `test/measure-reduction.js` script already has siteProfile in its TOOLS array, which will show the aggregate impact
- Some tests in `test/real-site-edges.spec.js` may assert on specific path strings — update those to match the shorter format
- The `motionProfile` and `touchTargets` tools store paths per element — these will benefit most from shorter paths on dense pages

## Key file paths

- `src/utils/dom.js` — contains `elPath()`, the function to modify
- `docs/signal-noise-recommendations.md` — recommendation #8 has the spec
- `test/measure-reduction.js` — live-site comparison script
- `threads/signal-noise.md` — thread index
