# Thread: Test Suite Expansion

**Last parked**: 2026-03-27
**Status**: Infrastructure complete, ready for real-site analysis
**Handoff**: `memories/handoff-test-infra-setup.md`

## Key files

- `test/helpers.js` — CDP connection + toolkit injection fixture
- `playwright.config.js` — fixture server config
- `test/*.spec.js` — 47 tests across 5 spec files
- `test/fixtures/*.html` — 3 HTML fixtures (color, layout, typography)

## Next step

Analyze real websites with the toolkit, identify gaps and edge cases, write new tests based on findings. User mentioned this explicitly as the goal for next session.

## Context

- 47/47 tests passing in 5s against Browserless at 10.23.20.10:3000
- Fixture server binds to 10.23.7.50:8787 (LAN-routable from browser)
- Tests use `connectOverCDP` (not Playwright protocol) — this matters
