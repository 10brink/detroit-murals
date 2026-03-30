// Shared validation helpers for API endpoints — sanitization, URL checks, coordinate bounds, ID validation

export function sanitizeString(value, maxLength = 200) {
	if (value == null) return null;
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	if (trimmed.length > maxLength) return trimmed.slice(0, maxLength);
	return trimmed;
}

export function isValidCloudinaryUrl(url, { cloudName, folderPrefix = '' } = {}) {
	if (!url || typeof url !== 'string') return false;
	if (url.length > 500) return false;

	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:') return false;
		if (parsed.hostname !== 'res.cloudinary.com') return false;

		const parts = parsed.pathname.split('/').filter(Boolean);
		if (parts.length < 4) return false;
		if (parts[0] !== cloudName) return false;
		if (parts[1] !== 'image' || parts[2] !== 'upload') return false;

		if (!folderPrefix) return true;

		const uploadPath = parts.slice(3).join('/');
		return uploadPath.includes(`/${folderPrefix}`) || uploadPath.startsWith(folderPrefix);
	} catch {
		return false;
	}
}

export function isValidCoordinates(lat, lng) {
	if (typeof lat !== 'number' || typeof lng !== 'number') return false;
	if (isNaN(lat) || isNaN(lng)) return false;
	if (lat < -90 || lat > 90) return false;
	if (lng < -180 || lng > 180) return false;
	return true;
}

export function isValidId(id) {
	if (typeof id !== 'number') return false;
	return Number.isInteger(id) && id > 0;
}
