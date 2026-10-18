# Desktop Plus fork

Read [`docs/web-patches.md`](docs/web-patches.md) before changing the browser
port or Space App Vibing integration. Read
[`web-server/FORK-OVERLAY.md`](web-server/FORK-OVERLAY.md) when syncing upstream.

- General browser workflows and compatibility helpers live under
  `app/src/patches/web/`; host-specific hooks and appearance live under
  `app/src/patches/vibing/`.
- Companion patches live under `web-server/src/patches/web/` or
  `web-server/src/patches/vibing/` according to ownership.
- Keep shared Desktop component changes to explicit helper calls and optional
  props. Reuse their rendering and keep lower-level modules independent of the
  browser application root.
- Preserve behavior when reorganizing code. Keep authentication, Git mutation
  safeguards, listener cleanup, and preference keys intact.
- Run the checks listed in the patch map, build with `NODE_ENV=production`, and
  verify embedded and standalone behavior after renderer changes.
- Never edit generated `web-server/public/` files. Refresh Vibing bundles from
  committed source and keep its fork pin and native archive consistent.

## Working on GitHub Desktop

Follow the repository's [contribution guidance](.github/CONTRIBUTING.md)
and [development instructions](.github/copilot-instructions.md).
These instructions supplement those guides; they do not change contribution
eligibility or merge requirements.

### Preparing team-authored pull requests

Before preparing or updating a team-authored PR, use the
[prepare-team-pr skill](.agents/skills/prepare-team-pr/SKILL.md).
Follow its authorization checks, evidence collection, review assessment,
and ownership requirements.

Read the current [PR template](.github/pull_request_template.md).
Preserve its sections and generate or update the skill's
`Team-authored review` section in the PR body, not in the template.
