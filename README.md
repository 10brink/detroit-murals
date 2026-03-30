# Detroit Mural Map

Interactive SvelteKit map for browsing, submitting, and moderating Detroit murals.

## Commands

```bash
npm run dev
npm run build
npm test
```

## What The Tests Cover

- Public neighborhood metadata only reflects `approved` murals.
- User-submitted image URLs must belong to this app's Cloudinary cloud and upload folder.
- Admin login cookies are stateless and survive process restarts.
- Duplicate flag responses must not wipe the existing flag count in the UI.

## Operational Notes

- Public map reads intentionally exclude `pending` and `rejected` murals.
- User submissions still upload directly from the browser to Cloudinary, then the server validates the returned URL before writing to Postgres.
- Rate limiting and duplicate-flag throttling are still process-local; if you need hard guarantees across multiple app instances, move those controls to shared storage.
