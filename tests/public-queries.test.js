// Automated tests for public SQL helpers that should only expose approved murals
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	buildAreasQuery,
	buildNeighborhoodsQuery,
	PUBLIC_MURAL_STATUS
} from '../src/lib/public-queries.js';

test('areas query filters to approved murals and skips blank neighborhoods', () => {
	const sql = buildAreasQuery();

	assert.match(sql, new RegExp(`status = '${PUBLIC_MURAL_STATUS}'`));
	assert.match(sql, /neighborhood != ''/);
});

test('neighborhood boundary query filters to approved murals', () => {
	const sql = buildNeighborhoodsQuery();

	assert.match(sql, new RegExp(`status = '${PUBLIC_MURAL_STATUS}'`));
	assert.match(sql, /HAVING COUNT\(\*\) >= 3/);
});
