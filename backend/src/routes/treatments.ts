// ============================================================================
// Treatments Route — CRUD de eventos de tratamento (careportal)
// ============================================================================

import { Router } from 'express';
import {
  getTreatments,
  createTreatment,
  deleteTreatment,
} from '../db/queries.js';

const router = Router();

// Campos obrigatórios por tipo de evento
const REQUIRED_FIELDS: Record<string, string[]> = {
  'Meal Bolus':        ['insulin', 'carbs'],
  'Correction Bolus':  ['insulin'],
  'Carb Correction':   ['carbs'],
  'BG Check':          ['glucose'],
  'Note':              ['notes'],
  // Device / consumable age tracking — no required fields beyond eventType + created_at
  'Sensor Change':     [],
  'Site Change':       [],
  'Insulin Change':    [],  // IAGE — generic (pump reservoir, vial or undifferentiated pen)
  'Basal Pen Change':  [],
  'Rapid Pen Change':  [],
  // Pump-specific
  'Temp Basal':        ['rate', 'duration'],
  // Lifestyle
  'Exercise':          ['duration'],
  // MDI — basal diária via caneta
  'Basal Insulin':     ['insulin'],
};

const VALID_EVENT_TYPES = Object.keys(REQUIRED_FIELDS);

// GET /api/treatments
// query: startDate, endDate, limit (default 200), eventType
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, eventType } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;

    const startDateObj = startDate ? new Date(startDate as string) : undefined;
    const endDateObj   = endDate   ? new Date(endDate   as string) : undefined;

    let treatments = await getTreatments(startDateObj, endDateObj, limit);

    if (eventType && typeof eventType === 'string') {
      treatments = treatments.filter((t) => t.eventType === eventType);
    }

    return res.json({
      success: true,
      data: treatments,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching treatments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch treatments',
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/treatments
router.post('/', async (req, res) => {
  try {
    const { eventType, created_at, timestamp, glucose, carbs, insulin,
            protein, fat, notes, units, glucoseType, enteredBy, duration,
            rate, rateMode, exerciseType, intensity } = req.body;

    // Validar tipo de evento
    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `eventType inválido. Valores aceitos: ${VALID_EVENT_TYPES.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Validar campos obrigatórios por tipo
    const required = REQUIRED_FIELDS[eventType] ?? [];
    const bodyMap: Record<string, unknown> = { glucose, carbs, insulin, notes, rate, duration };
    const missing = required.filter((f) => bodyMap[f] == null || bodyMap[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Campos obrigatórios faltando para ${eventType}: ${missing.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    const doc: Record<string, unknown> = {
      eventType,
      created_at: created_at ?? new Date().toISOString(),
    };

    if (timestamp    != null) doc.timestamp    = timestamp;
    if (enteredBy    != null) doc.enteredBy    = enteredBy;
    if (glucose      != null) doc.glucose      = Number(glucose);
    if (glucoseType  != null) doc.glucoseType  = glucoseType;
    if (carbs        != null) doc.carbs        = Number(carbs);
    if (insulin      != null) doc.insulin      = Number(insulin);
    if (protein      != null) doc.protein      = Number(protein);
    if (fat          != null) doc.fat          = Number(fat);
    if (duration     != null) doc.duration     = Number(duration);
    if (rate         != null) doc.rate         = Number(rate);
    if (rateMode     != null) doc.rateMode     = String(rateMode);
    if (notes        != null) doc.notes        = String(notes);
    if (units        != null) doc.units        = units;
    if (exerciseType != null) doc.exerciseType = String(exerciseType);
    if (intensity    != null) doc.intensity    = String(intensity);

    const treatment = await createTreatment(doc as any);

    return res.status(201).json({
      success: true,
      data: treatment,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating treatment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create treatment',
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /api/treatments/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteTreatment(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Treatment not found',
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error deleting treatment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete treatment',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
