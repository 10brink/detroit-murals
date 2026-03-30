// Public query helpers — keep moderation-only murals out of neighborhood counts and polygons
export const PUBLIC_MURAL_STATUS = 'approved';

export function buildAreasQuery() {
	return `
		SELECT neighborhood, COUNT(*) AS count
		FROM murals
		WHERE status = '${PUBLIC_MURAL_STATUS}'
			AND neighborhood IS NOT NULL
			AND neighborhood != ''
		GROUP BY neighborhood
		ORDER BY neighborhood
	`;
}

export function buildNeighborhoodsQuery() {
	return `
		SELECT
			neighborhood,
			COUNT(*) AS count,
			ST_AsGeoJSON(
				ST_Buffer(
					ST_ConvexHull(ST_Collect(geom)),
					0.002
				)
			) AS geojson
		FROM murals
		WHERE status = '${PUBLIC_MURAL_STATUS}'
			AND neighborhood IS NOT NULL
			AND neighborhood != ''
		GROUP BY neighborhood
		HAVING COUNT(*) >= 3
		ORDER BY neighborhood
	`;
}
