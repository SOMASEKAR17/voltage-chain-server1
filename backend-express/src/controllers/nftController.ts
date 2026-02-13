import { RequestHandler } from 'express';
import * as nftService from '../services/nftService';

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
