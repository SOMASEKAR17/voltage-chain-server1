import { RequestHandler } from 'express';
import * as nftService from '../services/nftService';
import * as batteryService from '../services/batteryService';

export const mintBatteryNFT: RequestHandler = async (req, res, next) => {
  try {
    const { battery_code, owner_wallet, cid, health_score } = req.body;

    if (!battery_code || !owner_wallet || !cid) {
      return res.status(400).json({
        error: 'battery_code, owner_wallet, cid required',
      });
    }

    const { tokenId, txHash } = await nftService.mintBatteryNFT(
      battery_code,
      health_score || 100, // Default to 100 if not provided
      cid,
      owner_wallet
    );

    // Sync with Database
    try {
      const battery = await batteryService.getBatteryIdByCode(battery_code);
      if (battery) {
        await batteryService.updateBatteryNFT(battery.id, tokenId, txHash);
        await batteryService.recordHistoryEvent({
          battery_code: battery_code,
          brand: battery.brand,
          event_type: 'Minted',
          soh_percent: health_score || 100,
          owner_wallet: owner_wallet,
          nft_token_id: tokenId
        });
      } else {
        console.warn(`Battery with code ${battery_code} not found in DB during minting sync.`);
      }
    } catch (dbErr) {
      console.error("Failed to sync minting with DB:", dbErr);
      // We don't fail the request because the NFT was already minted
    }

    res.json({
      success: true,
      message: 'Battery NFT minted',
      data: { tokenId, txHash },
    });
  } catch (err) {
    next(err);
  }
};

export const updateBatteryMetadata: RequestHandler = async (req, res, next) => {
  try {
    const { tokenId, cid } = req.body;

    if (!tokenId || !cid) {
      return res.status(400).json({
        error: 'tokenId and cid required',
      });
    }

    const txHash = await nftService.updateBatteryMetadata(tokenId, cid);

    // Sync with Database
    try {
      const battery = await batteryService.getBatteryByTokenId(tokenId);
      if (battery) {
         await batteryService.recordHistoryEvent({
          battery_code: battery.battery_code,
          brand: battery.brand,
          event_type: 'Metadata Update',
          soh_percent: (battery.current_capacity && battery.initial_capacity) ? (battery.current_capacity / battery.initial_capacity) * 100 : undefined, // approximate
          owner_wallet: "system", // or unknown
          nft_token_id: tokenId,
          notes: `New CID: ${cid}`
        });
      }
    } catch (dbErr) {
       console.error("Failed to sync metadata update with DB:", dbErr);
    }

    res.json({
      success: true,
      message: 'Battery metadata updated',
      data: { tokenId, txHash },
    });
  } catch (err) {
    next(err);
  }
};

export const transferBatteryNFT: RequestHandler = async (req, res, next) => {
  try {
    const { tokenId, from, to } = req.body;

    if (!tokenId || !from || !to) {
      return res.status(400).json({
        error: 'tokenId, from, to required',
      });
    }

    const txHash = await nftService.transferBatteryNFT(tokenId, from, to);

    // Sync with Database
    try {
      const battery = await batteryService.getBatteryByTokenId(tokenId);
      if (battery) {
        await batteryService.recordHistoryEvent({
          battery_code: battery.battery_code,
          brand: battery.brand,
          event_type: 'Transfer',
          owner_wallet: to,
          nft_token_id: tokenId,
          notes: `From: ${from} To: ${to}`
        });
        // Note: We might want to update the battery owner in the battery table too if we track it there, 
        // but 'batteries' table doesn't seem to have 'owner_wallet' column based on schema.sql?
        // Wait, schema check:
        // CREATE TABLE public.batteries (... no owner_wallet ...)
        // CREATE TABLE public.users ( ... wallet_address ...)
        // CREATE TABLE public.listings ( ... seller_id ...)
        // The 'owner_wallet' in listBattery seems to come from input but not stored in 'batteries' table directly?
        // Ah, batteryService: createBatteryForListing takes owner_wallet but createBattery INSERTs don't use it.
        // Let's look at createBatteryForListing in batteryService.ts
        // It does NOT insert owner_wallet into batteries table.
        // So ownership is tracked by NFT ownership (on-chain) or listings.
        // So just recording history is fine.
      }
    } catch (dbErr) {
      console.error("Failed to sync transfer with DB:", dbErr);
    }

    res.json({
      success: true,
      message: 'Battery NFT transferred',
      data: { tokenId, txHash },
    });
  } catch (err) {
    next(err);
  }
};

export const burnBatteryNFT: RequestHandler = async (req, res, next) => {
  try {
    const { tokenId } = req.body;

    if (!tokenId) {
      return res.status(400).json({
        error: 'tokenId required',
      });
    }

    const txHash = await nftService.burnBatteryNFT(tokenId);

    // Sync with Database
    try {
      const battery = await batteryService.getBatteryByTokenId(tokenId);
      if (battery) {
        await batteryService.updateBatteryBurnStatus(tokenId);
        await batteryService.recordHistoryEvent({
          battery_code: battery.battery_code,
          brand: battery.brand,
          event_type: 'Burnt',
          owner_wallet: "0x0000000000000000000000000000000000000000",
          nft_token_id: tokenId
        });
      }
    } catch (dbErr) {
       console.error("Failed to sync burn with DB:", dbErr);
    }

    res.json({
      success: true,
      message: 'Battery NFT burned',
      data: { tokenId, txHash },
    });
  } catch (err) {
    next(err);
  }
};

export const getBatteryOnChain: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.tokenId;
    const tokenId = Array.isArray(raw) ? raw[0] : raw;
    if (!tokenId) {
      return res.status(400).json({
        error: 'tokenId required',
      });
    }

    const data = await nftService.getBatteryOnChain(tokenId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};
