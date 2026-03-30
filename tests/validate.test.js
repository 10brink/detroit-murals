// Automated tests for Cloudinary submission URL validation
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCloudinaryUrl } from '../src/lib/validate.js';

test('accepts URLs from the configured Cloudinary cloud and folder', () => {
	assert.equal(
		isValidCloudinaryUrl(
			'https://res.cloudinary.com/demo/image/upload/v123/detroit-murals/user/example.jpg',
			{ cloudName: 'demo', folderPrefix: 'detroit-murals/' }
		),
		true
	);
});

test('rejects Cloudinary URLs from a different cloud', () => {
	assert.equal(
		isValidCloudinaryUrl(
			'https://res.cloudinary.com/other/image/upload/v123/detroit-murals/user/example.jpg',
			{ cloudName: 'demo', folderPrefix: 'detroit-murals/' }
		),
		false
	);
});

test('rejects Cloudinary URLs outside the allowed folder prefix', () => {
	assert.equal(
		isValidCloudinaryUrl(
			'https://res.cloudinary.com/demo/image/upload/v123/somewhere-else/example.jpg',
			{ cloudName: 'demo', folderPrefix: 'detroit-murals/' }
		),
		false
	);
});
