// ============================================================================
// MongoDB Query Functions - Nightscout Collections
// ============================================================================

import { ObjectId } from 'mongodb';
import { getDatabase } from './connection.js';
import type {
  GlucoseEntry,
  Treatment,
  DeviceStatus,
  Profile,
  GlucoseQueryParams,
} from '../types/index.js';

// ============================================================================
// Glucose Entries (SGV - Sensor Glucose Values)
// ============================================================================

export async function getGlucoseEntries(
  params: GlucoseQueryParams = {}
): Promise<GlucoseEntry[]> {
  const db = getDatabase();
  const collection = db.collection<GlucoseEntry>('entries');

  const query: any = { type: 'sgv' };

  // Date range filter
  if (params.startDate || params.endDate) {
    query.date = {};
    if (params.startDate) {
      query.date.$gte = new Date(params.startDate).getTime();
    }
    if (params.endDate) {
      query.date.$lte = new Date(params.endDate).getTime();
    }
  }

  const entries = await collection
    .find(query)
    .sort({ date: -1 })
    .limit(params.limit || 1000)
    .skip(params.skip || 0)
    .toArray();

  return entries;
}

export async function getLatestGlucose(): Promise<GlucoseEntry | null> {
  const db = getDatabase();
  const collection = db.collection<GlucoseEntry>('entries');

  const entry = await collection
    .find({ type: 'sgv' })
    .sort({ date: -1 })
    .limit(1)
    .toArray();

  return entry[0] || null;
}

export async function getGlucoseByDateRange(
  startDate: Date,
  endDate: Date
): Promise<GlucoseEntry[]> {
  const db = getDatabase();
  const collection = db.collection<GlucoseEntry>('entries');

  const entries = await collection
    .find(
      {
        type: 'sgv',
        date: {
          $gte: startDate.getTime(),
          $lte: endDate.getTime(),
        },
      },
      { maxTimeMS: 60_000 }   // 60 s hard limit — avoids hanging requests
    )
    .sort({ date: 1 })
    .toArray();

  return entries;
}

// ============================================================================
// Treatments (Insulin, Carbs, etc.)
// ============================================================================

export async function getTreatments(
  startDate?: Date,
  endDate?: Date,
  limit: number = 500
): Promise<Treatment[]> {
  const db = getDatabase();
  const collection = db.collection<Treatment>('treatments');

  const query: any = {};

  if (startDate || endDate) {
    query.created_at = {};
    if (startDate) {
      query.created_at.$gte = startDate.toISOString();
    }
    if (endDate) {
      query.created_at.$lte = endDate.toISOString();
    }
  }

  const treatments = await collection
    .find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();

  return treatments;
}

export async function createTreatment(
  data: Omit<Treatment, '_id'>
): Promise<Treatment> {
  const db = getDatabase();
  const collection = db.collection<Omit<Treatment, '_id'>>('treatments');

  const doc = {
    ...data,
    created_at: data.created_at ?? new Date().toISOString(),
  };

  const result = await collection.insertOne(doc as any);

  return { ...doc, _id: result.insertedId.toString() } as Treatment;
}

export async function deleteTreatment(id: string): Promise<boolean> {
  const db = getDatabase();
  const collection = db.collection('treatments');

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return false;
  }

  const result = await collection.deleteOne({ _id: objectId });
  return result.deletedCount === 1;
}

export async function getTreatmentsByType(
  eventType: string,
  startDate?: Date,
  endDate?: Date
): Promise<Treatment[]> {
  const db = getDatabase();
  const collection = db.collection<Treatment>('treatments');

  const query: any = { eventType };

  if (startDate || endDate) {
    query.created_at = {};
    if (startDate) {
      query.created_at.$gte = startDate.toISOString();
    }
    if (endDate) {
      query.created_at.$lte = endDate.toISOString();
    }
  }

  const treatments = await collection
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  return treatments;
}

// ============================================================================
// Device Status (Pump, Loop, Uploader)
// ============================================================================

export async function getLatestDeviceStatus(): Promise<DeviceStatus | null> {
  const db = getDatabase();
  const collection = db.collection<DeviceStatus>('devicestatus');

  const status = await collection
    .find({})
    .sort({ created_at: -1 })
    .limit(1)
    .toArray();

  return status[0] || null;
}

export async function getDeviceStatusHistory(
  startDate: Date,
  endDate: Date
): Promise<DeviceStatus[]> {
  const db = getDatabase();
  const collection = db.collection<DeviceStatus>('devicestatus');

  const statuses = await collection
    .find({
      created_at: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    })
    .sort({ created_at: -1 })
    .toArray();

  return statuses;
}

// ============================================================================
// Profile (Basal rates, ISF, IC ratio, etc.)
// ============================================================================

export async function getActiveProfile(): Promise<Profile | null> {
  const db = getDatabase();
  const collection = db.collection<Profile>('profile');

  const profile = await collection
    .find({})
    .sort({ startDate: -1 })
    .limit(1)
    .toArray();

  return profile[0] || null;
}

// ============================================================================
// Database Stats
// ============================================================================

export async function getDatabaseStats() {
  const db = getDatabase();

  const [entriesCount, treatmentsCount, deviceStatusCount] = await Promise.all([
    db.collection('entries').countDocuments({ type: 'sgv' }),
    db.collection('treatments').countDocuments(),
    db.collection('devicestatus').countDocuments(),
  ]);

  // Get date range
  const oldestEntry = await db
    .collection<GlucoseEntry>('entries')
    .find({ type: 'sgv' })
    .sort({ date: 1 })
    .limit(1)
    .toArray();

  const newestEntry = await db
    .collection<GlucoseEntry>('entries')
    .find({ type: 'sgv' })
    .sort({ date: -1 })
    .limit(1)
    .toArray();

  return {
    entriesCount,
    treatmentsCount,
    deviceStatusCount,
    dateRange: {
      oldest: oldestEntry[0]?.date ? new Date(oldestEntry[0].date) : null,
      newest: newestEntry[0]?.date ? new Date(newestEntry[0].date) : null,
    },
  };
}
