import { Request, Response, RequestHandler } from 'express';
import * as batteryService from '../services/batteryService';
import * as nftService from '../services/nftService';
import * as questionnaireService from '../services/questionnaireService';
import * as listingService from '../services/listingService';
import { validateBatteryPayload } from '../utils/validators';
import { ListBatteryResponse, QuestionnaireData } from '../types/api.types';

export class BatteryController {
  static getBattery: RequestHandler = async (req, res, next) => {
    try {
      const { id } = req.params;
      const batteryId = Array.isArray(id) ? id[0] : id;
      const data = await batteryService.getBatteryStatus(batteryId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  static createBattery: RequestHandler = async (req, res, next) => {
    try {
      if (!validateBatteryPayload(req.body)) return res.status(400).json({ error: 'invalid payload' });
      const created = await batteryService.createBattery(req.body);
      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  };

  static listBattery: RequestHandler = async (req: Request, res: Response, next) => {
    try {
      const {
        battery_code,
        brand,
        initial_capacity,
        current_capacity,
        manufacture_year,
        charging_cycles,
        owner_wallet,
        questionnaire,
      } = req.body;

      if (
        !battery_code ||
        !brand ||
        initial_capacity == null ||
        current_capacity == null ||
        manufacture_year == null ||
        !owner_wallet
      ) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['battery_code', 'brand', 'initial_capacity', 'current_capacity', 'manufacture_year', 'owner_wallet'],
        });
      }

      const history = await batteryService.getBatteryHistory(battery_code, brand);
      let nft_exists = false;
      let nft_token_id: string | undefined;

      if (history) {
        nft_exists = true;
        nft_token_id = history.nft_token_id;
      }

      // Calculate health score based on capacity degradation
      const capacity_degradation = ((initial_capacity - current_capacity) / initial_capacity) * 100;
      const health_score = Math.max(0, Math.min(100, 100 - capacity_degradation));

      const battery = await batteryService.createBatteryForListing({
        battery_code,
        brand,
        initial_capacity,
        current_capacity,
        manufacture_year,
        charging_cycles,
        owner_wallet,
      });

      if (!nft_exists) {
        const { tokenId, txHash } = await nftService.mintBatteryNFT(battery_code, health_score);

        await batteryService.updateBatteryNFT(battery.id, tokenId, txHash);
        nft_token_id = tokenId;
      } else {
        if (nft_token_id) {
          await nftService.updateBatteryHealth(nft_token_id, health_score);
        }
      }

      await batteryService.recordHistoryEvent({
        battery_code,
        brand,
        event_type: 'listing',
        health_score,
        owner_wallet,
        nft_token_id,
      });

      // Save questionnaire if provided and listing exists
      if (questionnaire) {
        const listingId = await listingService.getListingByBatteryId(battery.id);
        if (listingId) {
          try {
            const existing = await questionnaireService.getQuestionnaireByListingId(listingId);
            if (existing) {
              await questionnaireService.updateQuestionnaire(listingId, questionnaire as QuestionnaireData);
            } else {
              await questionnaireService.createQuestionnaire(listingId, questionnaire as QuestionnaireData);
            }
          } catch (err) {
            // Log but don't fail the request if questionnaire save fails
            console.error('Failed to save questionnaire:', err);
          }
        }
      }

      const response: ListBatteryResponse = {
        success: true,
        message: 'Battery listed successfully on marketplace',
        data: {
          battery_id: battery.id,
          battery_code,
          health_score,
          predicted_voltage: 0, // Deprecated, kept for backward compatibility
          current_voltage: 0, // Deprecated, kept for backward compatibility
          nft_token_id,
          is_new_nft: !nft_exists,
          listing_url: `/marketplace/${battery.id}`,
        },
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  };
}

export const getBattery = BatteryController.getBattery;
export const createBattery = BatteryController.createBattery;
export const listBattery = BatteryController.listBattery;
