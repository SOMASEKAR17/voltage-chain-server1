import { v2 as cloudinary } from 'cloudinary';

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

cloudinary.config({
    cloud_name: cloud_name || '',
    api_key: api_key || '',
    api_secret: api_secret || '',
});

export const cloudinaryConfig = {
    cloud_name: cloud_name || '',
    api_key: api_key || '',
    api_secret: api_secret || '',
};
export function isCloudinaryConfigured(): boolean {
    return Boolean(cloud_name && api_key && api_secret);
}

export async function uploadImageBuffer(
    buffer: Buffer,
    options: { folder?: string; public_id?: string; mimeType?: string } = {}
): Promise<string> {
    if (!isCloudinaryConfigured()) throw new Error('Cloudinary not configured');
    const mime = options.mimeType || 'image/jpeg';
    const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
            dataUri,
            {
                folder: options.folder || 'ocr_labels',
                resource_type: 'image',
                ...options,
            },
            (err, result) => {
                if (err) return reject(err);
                if (!result?.secure_url) return reject(new Error('Cloudinary upload failed: no URL returned'));
                resolve(result.secure_url);
            }
        );
    });
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
