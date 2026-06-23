# AGENTS.md

## Cursor Cloud specific instructions

This repo is a [Quartz v4](https://quartz.jzhao.xyz) digital garden (static site generator). Notes live in `content/`; site code in `quartz/`. There is a single service: the local Quartz dev server.

- Dependencies are installed via the startup update script (`npm ci`). Node >=22 / npm >=10.9.2 is required (`.npmrc` sets `engine-strict=true`).
- Run/serve (dev): `npx quartz build --serve` serves at `http://localhost:8080` and hot-reloads on changes to `content/`. Start it in a long-lived session (e.g. tmux); do not put it in the update script.
- Test: `npm test` (node test runner via `tsx --test`).
- Lint/check: `npm run check` (= `tsc --noEmit` + `prettier --check`). NOTE: in the current repo state this command fails for pre-existing reasons unrelated to setup — `tsc` errors on a deprecated `moduleResolution=node10` (TypeScript 6) and Prettier reports many unformatted `content/` files. Treat these as pre-existing, not environment breakage.
- The `post-commit` git hook (enabled via `npm run hooks:install`) regenerates `blog-activity.cache.json`; it is not required for building or serving.
- `CustomOgImages` emitter is commented out in `quartz.config.ts` because it needs network access to fetch fonts.
