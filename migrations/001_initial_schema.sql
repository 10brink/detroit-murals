-- Migration 001 — initial schema: PostGIS extension, murals and areas tables with spatial indexes

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS murals (
    id SERIAL PRIMARY KEY,
    mural_id TEXT UNIQUE,
    title TEXT,
    address TEXT,
    artist TEXT,
    neighborhood TEXT,
    image_url TEXT,
    notes TEXT,
    source TEXT DEFAULT 'seed',
    name TEXT,
    flag_count INTEGER DEFAULT 0,
    flagged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(Point, 4326)
);

CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    name TEXT,
    slug TEXT UNIQUE,
    geom GEOMETRY(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS murals_geom_gix ON murals USING GIST (geom);
CREATE INDEX IF NOT EXISTS areas_geom_gix ON areas USING GIST (geom);
