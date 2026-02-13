import { RequestHandler } from 'express';
import * as walletService from '../services/walletService';

export const createWallet: RequestHandler = async (req, res, next) => {
    try {
        const wallet = walletService.createCustodialWallet();
        res.status(201).json({
            success: true,
            message: 'Wallet created successfully',
            data: wallet
        });
    } catch (err) {
        next(err);
    }
};
