# Mural Map — FORNICK.md

## What This Is

An interactive map of Detroit's street murals. You open a webpage, see a map of Detroit, and 550 murals show up as circular photo thumbnails. Click a thumbnail, get the full-size photo in a lightbox. Pick a neighborhood from the dropdown to filter. Toggle neighborhood boundary overlays. Flag a mural as removed. Submit new murals you've found — drop a pin, upload a photo.

## The Big Picture (Architecture)

Think of it like a sandwich:

1. **The bread on top** — A fullscreen Mapbox GL JS map running in the browser (SvelteKit renders the page, but the heavy lifting is client-side JavaScript talking to Mapbox's tile servers)
2. **The filling** — SvelteKit API routes that translate HTTP requests into SQL queries
3. **The bread on the bottom** — A PostgreSQL database with PostGIS extension on Neon (free tier), storing every mural as a geographic point

The browser asks the server "give me murals in this rectangle" (the viewport), the server asks PostGIS, PostGIS does blazing-fast spatial math with GIST indexes, and the response flows back up as JSON.

## Codebase Structure

```
murals/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              ← THE page. Map, markers, mobile controls, state.
│   │   ├── +layout.svelte            ← Imports Tailwind CSS globally
│   │   └── api/
│   │       ├── murals/+server.js     ← GET (bbox/neighborhood filter) + POST (flag)
│   │       ├── murals/submit/+server.js ← POST new user-submitted mural
│   │       ├── murals/edit/+server.js   ← POST update mural metadata
│   │       ├── areas/+server.js      ← Returns neighborhoods with mural counts
│   │       └── neighborhoods/+server.js ← Returns GeoJSON boundary polygons
│   ├── lib/
│   │   ├── BottomSheet.svelte        ← Touch-driven bottom sheet (mobile UI primitive)
│   │   ├── MuralLightbox.svelte      ← Lightbox: desktop overlay + mobile bottom sheet
│   │   ├── SubmitPanel.svelte        ← Submit form: desktop card + mobile bottom sheet
│   │   ├── cloudinary.js             ← URL transform helper for responsive images
│   │   ├── db.js                     ← pg.Pool connection to Neon
│   │   ├── auth.js                   ← Session management & admin auth
│   │   └── validate.js               ← Input validation helpers
│   ├── app.html                      ← HTML shell (viewport-fit=cover for iOS notch)
│   └── app.css                       ← Tailwind import + safe-area-pb utility
├── scripts/
│   ├── setup-db.sql                  ← CREATE tables + indexes (run once)
│   ├── seed-murals.js                ← Loads 550 murals from data/muralsdb.csv
│   └── run-sql.js                    ← Helper to run SQL files via Node (no psql needed)
├── data/
│   └── muralsdb.csv                  ← 550 murals from the muralApp repo
├── svelte.config.js                  ← adapter-node (for PM2 deployment)
├── vite.config.js                    ← SvelteKit + Tailwind v4 plugins
├── package.json
├── .env.example                      ← All required env vars
└── PRD.txt                           ← Product requirements
```

## Technologies & Why

| Tech | Why |
|------|-----|
| **SvelteKit** | Modern, fast, server routes built in. No need for a separate Express server. |
| **Svelte 5 runes** | `$state`, `$derived` — reactive primitives with no boilerplate. |
| **adapter-node** | Outputs a plain Node.js server PM2 can manage on the droplet. |
| **Tailwind CSS v4** | Utility classes, no separate config file with the Vite plugin. |
| **Mapbox GL JS** | Best free-tier map library. Vector tiles, smooth zoom, GeoJSON cluster source. |
| **PostgreSQL + PostGIS** | "Give me all points inside this rectangle" is a single SQL query with a GIST index. |
| **Neon** | Free managed Postgres with PostGIS. No self-hosting the database. |
| **pg** (node-postgres) | Raw SQL — Prisma doesn't support PostGIS spatial types. |
| **Cloudinary** | Free-tier image hosting. Browser uploads directly with an unsigned preset — no server-side SDK needed. On-the-fly transforms (width, format, quality) serve correctly sized images per context. |

## Key Decisions & Rationale

### Why raw SQL instead of an ORM?
PostGIS spatial functions like `ST_MakeEnvelope`, `ST_ConvexHull`, and `ST_MakePoint` are SQL extensions. No mainstream Node.js ORM supports them natively. We use `pg` directly and write clean parameterized queries.

### Why thumbnail HTML markers instead of Mapbox symbol layers?
Mapbox's native symbol layers support icons but not arbitrary circular image masks with borders. HTML markers via `mapboxgl.Marker({ element: el })` let us render real `<img>` tags with CSS border-radius, giving us true circular photo thumbnails. The downside: each marker is a DOM element, so we clear and recreate them on every viewport change. At 500 murals max per viewport this is fine.

### Why two marker sizes, and why do they shrink on mobile?
- **Desktop:** 144px individual, 72px cluster — big enough to see the art on a large screen
- **Mobile:** 96px individual, 48px cluster — smaller viewport means you need more map showing through, not less

The `isMobile` state variable (set by a resize listener) drives both the CSS size and the Cloudinary transform width passed to `img.src`. Mobile gets `w_192,h_192` (96px × 2 for retina) instead of the full-res original. Without this, a 72px thumbnail was downloading a 3MB DSLR photo.

### Why show a cluster thumbnail instead of just a count?
A gold circle with "23" tells you there are murals here. A photo of an actual mural makes you want to zoom in. The cluster thumbnail is the first mural in the cluster (via `getClusterLeaves`), chosen arbitrarily but consistently.

### Why Cloudinary instead of S3?
Cloudinary has a free tier (25GB) and supports unsigned browser uploads out of the box. S3 requires CORS setup, IAM policies, and presigned URLs. Cloudinary's `POST /v1_1/{cloud}/image/upload` with an upload preset is a single fetch call from the browser.

### Why skip authentication entirely?
MVP scope. Flag counts are visible but there's no moderation dashboard. Spam is a low risk for a niche local art map.

### Why Neon over Supabase?
Both are free. Supabase wraps Postgres in auth/REST/realtime layers we'll never use. Neon gives plain Postgres with a connection string. Less magic, fewer surprises.

## How It Works (Data Flow)

### Map rendering
1. Browser loads `+page.svelte`, initializes Mapbox centered on Detroit
2. On `map.load` and every `map.moveend` (debounced 300ms):
   - Gets viewport bounds → `bbox=minLng,minLat,maxLng,maxLat`
   - Fetches `/api/murals?bbox=...` → array of up to 500 murals
3. `updateMapData()` sets the GeoJSON cluster source data
4. On `map.idle` after data update: `renderThumbnails()` + `renderClusterThumbnails()`
5. `renderThumbnails()` — queries rendered `unclustered-point` features, creates 144px circular `<img>` HTML markers
6. `renderClusterThumbnails()` — queries rendered `clusters` features, calls `getClusterLeaves(clusterId, 1, 0)` for each to get the first mural's image, creates 72px HTML markers with a count badge

### Clustering config
- `clusterRadius: 30` — murals within 30px group together
- `clusterMaxZoom: 14` — at zoom 15+ everything shows as individual thumbnails
- Cluster circles layer is transparent (just for `queryRenderedFeatures` hit detection)

### Lightbox
Click any thumbnail → finds the mural by ID in `currentMurals` → sets `lightboxIndex` → Svelte renders the overlay. Arrow keys and nav arrows move through murals. Edit button opens inline fields to update address/artist/neighborhood (POSTs to `/api/murals/edit`). Flag button increments `flag_count` (POST to `/api/murals`).

### Neighborhood boundaries
Toggle button fetches `/api/neighborhoods` once, which returns GeoJSON polygons generated by `ST_Buffer(ST_ConvexHull(ST_Collect(geom)), 0.002)` — convex hull of each neighborhood's mural points, padded ~200m. Shown as a semi-transparent gold fill with an outline.

### User submissions
"+ Add Mural" enters pin-drop mode (crosshair cursor on desktop, instruction banner on mobile). Click/tap the map → blue temp marker + submission panel. User selects an image file → `exifr` is **lazy-loaded** at this point (dynamic import, separate JS chunk) to extract GPS coordinates. Browser uploads directly to Cloudinary → gets back a `secure_url`. User fills optional fields, hits Submit → POST to `/api/murals/submit` → new mural appears on map immediately.

### Mobile layout
The app was desktop-only originally. On screens below 768px (`md:` Tailwind breakpoint):
- The top-left control bar is hidden. A **bottom toolbar** takes over with three large buttons: Neighborhoods, + Add Mural, and a `⋯` overflow menu.
- Tapping Neighborhoods opens a **BottomSheet** with the full area list as large 48px tap targets.
- Tapping a mural opens the **lightbox as a bottom sheet** (snaps to 60vh / 95vh). Swipe left/right on the image to navigate murals.
- Tapping + Add Mural and then tapping the map opens the **submit form as a bottom sheet** with larger inputs.
- The map container uses `h-dvh` instead of `h-screen` to avoid iOS Safari's address bar shrinking the viewport.

### Cloudinary responsive images
Every image URL is passed through `cloudinaryUrl()` in `src/lib/cloudinary.js` before being used. It inserts a transform string after `/upload/`:

```
Before: https://res.cloudinary.com/cloud/image/upload/v123/path.jpg
After:  https://res.cloudinary.com/cloud/image/upload/c_fill,w_192,h_192,q_auto,f_auto/v123/path.jpg
```

Different contexts use different widths — cluster markers get `w_96` (48px × 2), individual markers get `w_192`, lightbox gets `w_800` on mobile and `w_1200` on desktop. `f_auto` lets Cloudinary serve WebP to browsers that support it.

## Gotchas & Lessons Learned

- **`ST_MakePoint(lng, lat)` — longitude FIRST.** PostGIS uses X,Y (cartesian), not lat,lng (geographic). Swapping these puts your Detroit murals in the ocean off Somalia.
- **Mapbox GL CSS must be explicitly imported.** Without it, the map container renders at 0x0 pixels.
- **Neon requires SSL.** `ssl: { rejectUnauthorized: false }` in the pg.Pool config. Without it, connections silently fail.
- **`PUBLIC_` prefix for SvelteKit env vars.** The Mapbox token and Cloudinary vars need `PUBLIC_` to be accessible in browser code.
- **adapter-node, not adapter-auto.** The default SvelteKit adapter doesn't produce a standalone Node.js server.
- **`getClusterLeaves` is async (callback).** The cluster thumbnail markers appear slightly after the cluster layer renders because we have to wait for the callback. This is imperceptible at normal usage.
- **Broken seed images.** All 550 seed murals link to `raw.githubusercontent.com/cpenalosa/detroitmurals/images/mXXXX.jpg`. Some of these 404 — the file was never committed to that repo. The `img.onerror` handler removes those markers and filters those murals out of `currentMurals`.
- **`psql` not installed on macOS.** Created `scripts/run-sql.js` as a Node.js alternative — runs SQL files via `pg` directly.
- **BottomSheet height uses vh, not px.** iOS Safari's `100vh` includes the address bar, making sheets overflow. Using percentage heights (tracked internally as vh values) and `h-dvh` on the map container sidesteps this.
- **Touch gestures on the bottom sheet vs. the map.** The sheet sits above the map with its own z-index. Touch events on the sheet area don't reach Mapbox, so pinch-zoom and pan still work fine on the visible map portion.
- **Swipe navigation in the lightbox vs. sheet drag.** The image swipe handler checks that horizontal delta exceeds vertical delta before treating it as navigation. Otherwise pulling the sheet down triggers a mural switch.
- **`exifr` is lazy-loaded.** It's ~50KB and only needed when a user picks a file. The dynamic `import('exifr')` inside `handleFileSelect` lets Vite split it into a separate chunk that's never downloaded unless you're submitting a mural.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/murals?bbox=...` | Murals in viewport (LIMIT 500) |
| GET | `/api/murals?neighborhood=...` | Murals in a neighborhood (LIMIT 500) |
| POST | `/api/murals` | Flag a mural (body: `{ id }`) |
| POST | `/api/murals/submit` | Add a new mural |
| POST | `/api/murals/edit` | Update mural metadata |
| GET | `/api/areas` | Neighborhood list with counts |
| GET | `/api/neighborhoods` | GeoJSON boundary polygons |

## Database Schema

```sql
murals (
  id           serial primary key,
  mural_id     text unique,          -- NULL for user submissions
  title        text,
  address      text,
  artist       text,
  neighborhood text,
  image_url    text,
  notes        text,
  source       text default 'seed',  -- 'seed' or 'user'
  flag_count   int default 0,
  flagged_at   timestamptz,
  created_at   timestamptz default now(),
  geom         geometry(Point, 4326)
)

CREATE INDEX murals_geom_gix ON murals USING GIST (geom);
```

## Environment Variables

```
DATABASE_URL=postgresql://...              # Neon connection string
PUBLIC_MAPBOX_TOKEN=pk....                 # Mapbox public token
PUBLIC_CLOUDINARY_CLOUD_NAME=...           # Cloudinary cloud name
PUBLIC_CLOUDINARY_UPLOAD_PRESET=...        # Unsigned upload preset name
```

## Setup

```bash
npm install
cp .env.example .env        # fill in all four vars

# Set up DB (use Neon's SQL editor or run-sql.js)
node scripts/run-sql.js scripts/setup-db.sql

# Seed 550 murals
node scripts/seed-murals.js

npm run dev
# → http://localhost:5173
```

## Deployment (DigitalOcean)

```bash
# On the droplet (Ubuntu 22.04):
npm ci && npm run build
pm2 start build/index.js --name mural-map
# Nginx: proxy :80 → localhost:3000
```
