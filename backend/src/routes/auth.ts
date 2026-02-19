// ============================================================================
// auth.ts — Login endpoint (public)
// POST /api/auth/login  { password } → { success, data: { token, expiresIn } }
// Validates password against API_SECRET env var using timingSafeEqual.
// Rate limited: 5 attempts per 15 minutes per IP.
// ============================================================================

import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Muitas tentativas. Tente novamente em 15 minutos.',
    timestamp: new Date().toISOString(),
  },
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body as { password?: string };

  const apiSecret = process.env.API_SECRET;
  if (!apiSecret) {
    return res.status(500).json({
      success: false,
      error: 'Configuração de autenticação ausente no servidor.',
      timestamp: new Date().toISOString(),
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Senha obrigatória.',
      timestamp: new Date().toISOString(),
    });
  }

  // Constant-time comparison to avoid timing attacks
  const provided = Buffer.from(password);
  const expected = Buffer.from(apiSecret);
  const valid =
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);

  if (!valid) {
    return res.status(401).json({
      success: false,
      error: 'Senha incorreta.',
      timestamp: new Date().toISOString(),
    });
  }

  const jwtSecret  = process.env.JWT_SECRET!;
  const expiresIn  = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];
  const token = jwt.sign({ role: 'owner' }, jwtSecret, { expiresIn });

  return res.json({
    success: true,
    data: { token, expiresIn },
    timestamp: new Date().toISOString(),
  });
});

export default router;
