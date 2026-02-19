// ============================================================================
// authenticate — JWT Bearer middleware
// Validates the Authorization: Bearer <token> header on protected routes.
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const token = header.slice(7);
    jwt.verify(token, process.env.JWT_SECRET!);
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Token inválido ou expirado',
      timestamp: new Date().toISOString(),
    });
  }
}
