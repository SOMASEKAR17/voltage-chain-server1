import { Request, Response, RequestHandler } from 'express';
import * as batteryService from '../services/batteryService';
import * as fastApiService from '../services/fastApiService';
import * as nftService from '../services/nftService';
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
      initial_voltage,
      years_used,
      owner_wallet,
      user_voltage,
      description,
      questionnaire,
    } = req.body;

    if (!battery_code || !brand || initial_voltage == null || years_used == null || !owner_wallet) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const fraudCheck = await fastApiService.checkFraud({
      battery_code,
      brand,
      initial_voltage,
      years_used,
    });

    if (fraudCheck.is_suspicious && fraudCheck.confidence > 0.8) {
      return res.status(400).json({
        error: 'Suspicious activity detected',
        details: fraudCheck.details,
      });
    }

    const history = await batteryService.getBatteryHistory(battery_code, brand);
    let nft_exists = false;
    let nft_token_id: string | undefined;

    if (history) {
      nft_exists = true;
      nft_token_id = history.nft_token_id;
    }

    let prediction;

    if (user_voltage !== undefined) {
      prediction = await fastApiService.predictVoltage({
        battery_code,
        brand,
        initial_voltage,
        years_used,
      });
    } else {
      if (!questionnaire) {
        return res.status(400).json({
          error: 'Please provide either measured voltage or complete the questionnaire',
          requires: 'questionnaire',
        });
      }

      prediction = await fastApiService.predictFromQuestionnaire({
        battery_code,
        brand,
        initial_voltage,
        years_used,
        questionnaire: questionnaire as QuestionnaireData,
      });
    }

    const final_voltage = user_voltage !== undefined ? user_voltage : prediction.predicted_voltage;

    if (user_voltage !== undefined) {
      const error_margin = Math.abs(prediction.predicted_voltage - user_voltage) / prediction.predicted_voltage;

      if (error_margin > 0.15) {
        if (!description) {
          return res.status(400).json({
            error: 'Voltage discrepancy detected',
            predicted_voltage: prediction.predicted_voltage,
            user_voltage,
            error_percentage: (error_margin * 100).toFixed(2),
            requires: 'description',
            message: 'Please explain why the voltage differs significantly from prediction',
          });
        }

        const validation = await fastApiService.validateDescription({
          battery_code,
          brand,
          initial_voltage,
          years_used,
          predicted_voltage: prediction.predicted_voltage,
          user_voltage,
          description,
        });

        if (!validation.is_valid || validation.confidence < 0.7) {
          return res.status(400).json({
            error: 'Unable to verify battery condition',
            message: 'Please re-verify the voltage measurement',
            validation_confidence: validation.confidence,
            reason: validation.reason,
          });
        }
      }
    }

    const battery = await batteryService.createBatteryForListing({
      battery_code,
      brand,
      initial_voltage,
      years_used,
      current_voltage: final_voltage,
      health_score: prediction.health_score,
      prediction_data: prediction,
      is_listed: true,
      owner_wallet,
    });

    if (!nft_exists) {
      const { tokenId, txHash } = await nftService.mintBatteryNFT(battery_code, prediction.health_score);

      await batteryService.updateBatteryNFT(battery.id, tokenId, txHash);
      nft_token_id = tokenId;
    } else {
      if (nft_token_id) {
        await nftService.updateBatteryHealth(nft_token_id, prediction.health_score);
      }
    }

    await batteryService.recordHistoryEvent({
      battery_code,
      brand,
      event_type: 'listing',
      voltage: final_voltage,
      health_score: prediction.health_score,
      owner_wallet,
      nft_token_id,
    });

    const response: ListBatteryResponse = {
      success: true,
      message: 'Battery listed successfully on marketplace',
      data: {
        battery_id: battery.id,
        battery_code,
        health_score: prediction.health_score,
        predicted_voltage: prediction.predicted_voltage,
        current_voltage: final_voltage,
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
