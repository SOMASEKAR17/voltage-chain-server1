import { RequestHandler } from 'express';
import * as listingService from '../services/listingService';

export const getListings: RequestHandler = async (req, res, next) => {
  try {
    const listings = await listingService.getListings();
    res.json({ data: listings });
  } catch (err) {
    next(err);
  }
};

export const getListingById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const listingId = Array.isArray(id) ? id[0] : id;
    const listing = await listingService.getListingById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json({ data: listing });
  } catch (err) {
    next(err); 
  }
};
