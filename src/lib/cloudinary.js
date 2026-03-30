// Adds Cloudinary on-the-fly transforms to image URLs for responsive delivery
/**
 * @param {string} url - Raw Cloudinary URL
 * @param {{ width?: number, height?: number, quality?: string, format?: string, crop?: string|null }} opts
 * @returns {string}
 */
export function cloudinaryUrl(url, { width, height, quality = 'auto', format = 'auto', crop = 'fill' } = {}) {
	if (!url?.includes('res.cloudinary.com')) return url;

	const transforms = [];
	if (crop) transforms.push(`c_${crop}`);
	if (width) transforms.push(`w_${width}`);
	if (height) transforms.push(`h_${height}`);
	if (quality) transforms.push(`q_${quality}`);
	if (format) transforms.push(`f_${format}`);

	if (transforms.length === 0) return url;

	return url.replace('/upload/', `/upload/${transforms.join(',')}/`);
}
