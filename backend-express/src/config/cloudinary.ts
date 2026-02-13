const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;
export const cloudinaryConfig = {
    cloud_name: cloud_name || '',
    api_key: api_key || '',
    api_secret: api_secret || '',
};
export function isCloudinaryConfigured(): boolean {
    return Boolean(cloud_name);
}
export function getImageUrl(imageUrl: string): string {
    if (!imageUrl)
        return '';
    if (/^https?:\/\//i.test(imageUrl))
        return imageUrl;
    if (!cloud_name)
        return imageUrl;
    return `https://res.cloudinary.com/${cloud_name}/image/upload/${imageUrl}`;
}
