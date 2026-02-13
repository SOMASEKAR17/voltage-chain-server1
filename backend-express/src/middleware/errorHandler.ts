import { Request, Response, NextFunction } from 'express';

function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Log error (could be enhanced with a logger)
  // eslint-disable-next-line no-console
  console.error(err);

  const status = err?.status || 500;
  const message = err?.message || 'Internal Server Error';

  res.status(status).json({ error: message });
}

export default errorHandler;
