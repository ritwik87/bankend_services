import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/dupr.types';
import logger from '../utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  const response: ApiResponse<null> = {
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    message: 'An unexpected error occurred'
  };

  res.status(500).json(response);
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const response: ApiResponse<null> = {
    success: false,
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.path}`
  };

  res.status(404).json(response);
};