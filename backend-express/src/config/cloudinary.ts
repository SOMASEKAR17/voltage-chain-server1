const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

export const cloudinaryConfig = {
  cloud_name: cloud_name || '',
  api_key: api_key || '',
  api_secret: api_secret || '',
};

/** True if we have enough config to resolve Cloudinary image URLs */
export function isCloudinaryConfigured(): boolean {
  return Boolean(cloud_name);
}

/**
 * Returns a URL suitable for displaying the image.
 * If imageUrl is already an absolute URL (http/https), returns it as-is.
 * Otherwise treats it as a Cloudinary public_id and builds the delivery URL.
 */
export function getImageUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (!cloud_name) return imageUrl;
  return `https://res.cloudinary.com/${cloud_name}/image/upload/${imageUrl}`;
}
