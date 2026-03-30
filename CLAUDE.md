# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Detroit Mural Map — interactive web app displaying 550+ street murals on a clustered Mapbox map. Users browse by neighborhood, view murals in a lightbox, flag removed murals, and submit new ones with photo uploads (including EXIF GPS extraction).

## Commands

```bash
npm run dev          # Start dev server (Vite, port 5173)
npm run build        # Production build (adapter-node → build/)
npm run preview      # Preview production build locally

npm run migrate              # Run pending SQL migrations (uses .env)
npm run migrate:staging      # Run migrations against staging DB (.env.staging)

npm run deploy               # Full deploy: install, migrate, build, PM2 restart (uses .env)
npm run deploy:staging       # Deploy to staging (.env.staging)
```

Migrations use a custom runner (`scripts/migrate.js`) that tracks applied files in a `schema_migrations` table. Add new migrations as numbered SQL files in `migrations/` (e.g., `003_add_foo.sql`).

## Architecture

**Single-page SvelteKit app** — one route (`src/routes/+page.svelte`) contains the entire UI: Mapbox map, lightbox, edit mode, pin-drop submission panel. All state uses Svelte 5 runes (`$state`, `$derived`).

**API routes** (SvelteKit server routes, no separate backend):
- `GET /api/murals` — bbox viewport query or neighborhood filter (PostGIS spatial)
- `POST /api/murals` — flag a mural as removed
- `POST /api/murals/submit` — create user-submitted mural
- `POST /api/murals/edit` — edit mural metadata
- `GET /api/areas` — distinct neighborhoods with counts
- `GET /api/neighborhoods` — neighborhood boundary GeoJSON polygons

**Database**: PostgreSQL 17 on Neon with PostGIS. Raw SQL via `pg` (node-postgres) — no ORM because Prisma doesn't support PostGIS. Connection pool in `src/lib/db.js`.

**Images**: Seed data uses GitHub raw URLs. User submissions upload directly from browser to Cloudinary (unsigned preset).

**Deployment**: DigitalOcean droplet, Nginx reverse proxy → PM2 running `build/index.js`.

## Tech Stack

- SvelteKit 5 with adapter-node
- Svelte 5 (runes)
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- Mapbox GL JS v3
- PostgreSQL + PostGIS (Neon)
- Cloudinary (image uploads)
- exifr (EXIF GPS extraction from photos)

## Environment Variables

See `.env.example`. Required: `DATABASE_URL`, `PUBLIC_MAPBOX_TOKEN`, `PUBLIC_CLOUDINARY_CLOUD_NAME`, `PUBLIC_CLOUDINARY_UPLOAD_PRESET`. Staging uses `.env.staging` with a separate Neon branch and Cloudinary preset.

## Key Patterns

- Map markers are custom HTML elements (circular thumbnail images), not default Mapbox markers. Clusters show a preview thumbnail with a count badge.
- Viewport-based fetching: murals are re-fetched on `moveend` (debounced 300ms) using PostGIS `ST_MakeEnvelope` bounding box queries, limited to 500 results.
- The `murals` table has `source` column: `'seed'` for initial data, `'user'` for submissions. `mural_id` is NULL for user submissions.

## Scripts

- `scripts/seed-murals.js` — seed DB from `data/muralsdb.csv`
- `scripts/seed-areas.js` — seed neighborhood boundaries from GeoJSON
- `scripts/migrate-images.js` — migrate image URLs (e.g., to Cloudinary)
- `scripts/scrape-grkids.js` — scraper for additional mural data

## Documentation

Per project conventions: write a `FORNICK.md` explaining the project in plain language with analogies. Include a comment at the top of every file explaining what it does.
