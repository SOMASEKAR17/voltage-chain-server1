import { query } from '../config/postgres';
import { getImageUrl } from '../config/cloudinary';
import { ListingWithImages, ListingImage } from '../types/api.types';
interface ListingRow {
    id: string;
    battery_id: string;
    price: string;
    predicted_voltage: string | null;
    user_voltage: string | null;
    health_score: string | null;
    status: string | null;
    ai_verified: boolean | null;
    battery_code: string | null;
    brand: string | null;
}
interface ImageRow {
    id: string;
    listing_id: string;
    image_url: string;
    image_type: string;
    position: number;
}
export async function getListings(): Promise<ListingWithImages[]> {
    const listingsResult = await query<ListingRow>(`SELECT l.id, l.battery_id, l.price, l.predicted_voltage, l.user_voltage,
            l.health_score, l.status, l.ai_verified,
            b.battery_code, b.brand
     FROM public.listings l
     LEFT JOIN public.batteries b ON b.id = l.battery_id
     ORDER BY l.created_at DESC`);
    if (listingsResult.rows.length === 0)
        return [];
    const listingIds = listingsResult.rows.map((r) => r.id);
    const imagesResult = await query<ImageRow>(`SELECT id, listing_id, image_url, image_type, position
     FROM public.listing_images
     WHERE listing_id = ANY($1::uuid[])
     ORDER BY listing_id, position`, [listingIds]);
    const imagesByListing = new Map<string, ImageRow[]>();
    for (const row of imagesResult.rows) {
        const list = imagesByListing.get(row.listing_id) || [];
        list.push(row);
        imagesByListing.set(row.listing_id, list);
    }
    return listingsResult.rows.map((row) => {
        const images = (imagesByListing.get(row.id) || [])
            .sort((a, b) => a.position - b.position)
            .map((img): ListingImage => ({
            id: img.id,
            image_url: getImageUrl(img.image_url),
            image_type: img.image_type as 'gallery' | 'label',
            position: img.position,
        }));
        return {
            id: row.id,
            battery_id: row.battery_id,
            battery_code: row.battery_code ?? undefined,
            brand: row.brand ?? undefined,
            price: Number(row.price),
            predicted_voltage: row.predicted_voltage != null ? Number(row.predicted_voltage) : undefined,
            user_voltage: row.user_voltage != null ? Number(row.user_voltage) : undefined,
            health_score: row.health_score != null ? Number(row.health_score) : undefined,
            status: row.status ?? 'draft',
            ai_verified: row.ai_verified ?? false,
            images,
        };
    });
}
export async function createListing(params: {
    battery_id: string;
    seller_id: string;
    price: number;
    health_score?: number;
}): Promise<string> {
    const result = await query<{
        id: string;
    }>(`INSERT INTO public.listings (battery_id, seller_id, price, health_score, status)
     VALUES ($1, $2, $3, $4, 'draft')
     RETURNING id`, [params.battery_id, params.seller_id, params.price, params.health_score ?? null]);
    return result.rows[0].id;
}
export async function getListingByBatteryId(batteryId: string): Promise<string | null> {
    const result = await query<{
        id: string;
    }>(`SELECT id FROM public.listings WHERE battery_id = $1 LIMIT 1`, [batteryId]);
    return result.rows.length > 0 ? result.rows[0].id : null;
}
export async function getListingById(id: string): Promise<ListingWithImages | null> {
    const listingResult = await query<ListingRow>(`SELECT l.id, l.battery_id, l.price, l.predicted_voltage, l.user_voltage,
            l.health_score, l.status, l.ai_verified,
            b.battery_code, b.brand
     FROM public.listings l
     LEFT JOIN public.batteries b ON b.id = l.battery_id
     WHERE l.id = $1`, [id]);
    if (listingResult.rows.length === 0)
        return null;
    const row = listingResult.rows[0];
    const imagesResult = await query<ImageRow>(`SELECT id, listing_id, image_url, image_type, position
     FROM public.listing_images
     WHERE listing_id = $1
     ORDER BY position`, [id]);
    const images: ListingImage[] = imagesResult.rows.map((img) => ({
        id: img.id,
        image_url: getImageUrl(img.image_url),
        image_type: img.image_type as 'gallery' | 'label',
        position: img.position,
    }));
    return {
        id: row.id,
        battery_id: row.battery_id,
        battery_code: row.battery_code ?? undefined,
        brand: row.brand ?? undefined,
        price: Number(row.price),
        predicted_voltage: row.predicted_voltage != null ? Number(row.predicted_voltage) : undefined,
        user_voltage: row.user_voltage != null ? Number(row.user_voltage) : undefined,
        health_score: row.health_score != null ? Number(row.health_score) : undefined,
        status: row.status ?? 'draft',
        ai_verified: row.ai_verified ?? false,
        images,
    };
}
