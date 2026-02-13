import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    logger.error(`${req.method} ${req.originalUrl} -> ${status} - ${message}`);
    res.status(status).json({ error: message });
}
