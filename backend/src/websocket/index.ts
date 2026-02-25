// ============================================================================
// WebSocket Server - Real-time Glucose Updates
// Falls back to 30-second polling when MongoDB Change Streams are unavailable
// (Change Streams require a replica set; standalone MongoDB is polling-only)
// ============================================================================

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { getDatabase } from '../db/connection.js';
import type { GlucoseEntry, Treatment, DeviceStatus } from '../types/index.js';
import { evaluateAlarms } from '../alarms/evaluator.js';
import { broadcastAlarm } from '../alarms/pushService.js';
import { setSnooze, getSnoozeMap } from '../alarms/subscriptionStore.js';
import { DEFAULT_ALARM_CONFIG } from '../alarms/types.js';
import type { AlarmThresholds, AlarmConfig } from '../alarms/types.js';

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer, corsOrigin: string) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });

    socket.emit('connected', {
      message: 'Connected to Nightscout Modern WebSocket',
      timestamp: new Date().toISOString(),
    });
  });

  // Try Change Streams; fall back to polling if unavailable
  setupChangeStreams();

  console.log('🔌 WebSocket server initialized');

  return io;
}

function setupChangeStreams() {
  try {
    const db = getDatabase();
    let failCount = 0;
    const TOTAL_STREAMS = 3;

    function onStreamFail(_name: string) {
      failCount++;
      if (failCount === TOTAL_STREAMS) {
        console.warn('⏱  All Change Streams failed — switching to polling fallback (30s interval)');
        startPollingFallback();
      }
    }

    // ── entries ───────────────────────────────────────────────────────────────
    const entriesStream = db
      .collection<GlucoseEntry>('entries')
      .watch([{ $match: { 'fullDocument.type': 'sgv' } }], { fullDocument: 'updateLookup' });

    entriesStream.on('change', (change) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        io?.emit('glucose:new', {
          type: 'glucose',
          data: change.fullDocument,
          timestamp: new Date().toISOString(),
        });
      }
    });

    entriesStream.on('error', (error) => {
      console.warn(`⚠️  Change Stream unavailable (entries): ${error.message}`);
      entriesStream.close().catch(() => {});
      onStreamFail('entries');
    });

    // ── treatments ────────────────────────────────────────────────────────────
    const treatmentsStream = db
      .collection<Treatment>('treatments')
      .watch([], { fullDocument: 'updateLookup' });

    treatmentsStream.on('change', (change) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        io?.emit('treatment:new', {
          type: 'treatment',
          data: change.fullDocument,
          timestamp: new Date().toISOString(),
        });
      }
    });

    treatmentsStream.on('error', (error) => {
      console.warn(`⚠️  Change Stream unavailable (treatments): ${error.message}`);
      treatmentsStream.close().catch(() => {});
      onStreamFail('treatments');
    });

    // ── devicestatus ──────────────────────────────────────────────────────────
    const deviceStatusStream = db
      .collection<DeviceStatus>('devicestatus')
      .watch([], { fullDocument: 'updateLookup' });

    deviceStatusStream.on('change', (change) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        io?.emit('deviceStatus:new', {
          type: 'deviceStatus',
          data: change.fullDocument,
          timestamp: new Date().toISOString(),
        });
      }
    });

    deviceStatusStream.on('error', (error) => {
      console.warn(`⚠️  Change Stream unavailable (devicestatus): ${error.message}`);
      deviceStatusStream.close().catch(() => {});
      onStreamFail('devicestatus');
    });

    console.log('👁️  MongoDB Change Streams active (real-time updates enabled)');
  } catch (error: unknown) {
    console.warn('⚠️  Could not set up Change Streams:', (error as { message?: string })?.message ?? String(error));
    startPollingFallback();
  }
}

// ============================================================================
// Settings cache — avoids reading from DB on every 30 s poll tick
// ============================================================================

interface CachedSettings {
  alarmThresholds: AlarmThresholds;
  alarmConfig:     AlarmConfig;
}

let cachedSettings: CachedSettings | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60_000; // re-read every 5 min

async function getCachedSettings(): Promise<CachedSettings> {
  if (cachedSettings && Date.now() < cacheExpiry) return cachedSettings;
  try {
    const db  = getDatabase();
    const doc = await db.collection('app_settings').findOne({ key: 'global' });
    const data = (doc?.data ?? {}) as Record<string, unknown>;

    cachedSettings = {
      alarmThresholds: (data.alarmThresholds as AlarmThresholds) ?? {
        veryLow: 54, low: 70, high: 180, veryHigh: 250,
      },
      alarmConfig: (data.alarmConfig as AlarmConfig) ?? DEFAULT_ALARM_CONFIG,
    };
    cacheExpiry = Date.now() + CACHE_TTL_MS;
  } catch {
    cachedSettings = {
      alarmThresholds: { veryLow: 54, low: 70, high: 180, veryHigh: 250 },
      alarmConfig:     DEFAULT_ALARM_CONFIG,
    };
    cacheExpiry = Date.now() + 30_000; // retry sooner on error
  }
  return cachedSettings;
}

// ============================================================================
// Polling fallback — used when MongoDB is standalone (no replica set)
// Checks for new glucose entries every 30 seconds and emits via WebSocket.
// ============================================================================
let pollingIntervalHandle: ReturnType<typeof setInterval> | null = null;

function startPollingFallback() {
  if (pollingIntervalHandle !== null) return; // prevent duplicate intervals

  let lastSeenDate = Date.now();

  const poll = async () => {
    try {
      const db = getDatabase();
      const entries = await db
        .collection<GlucoseEntry>('entries')
        .find({ type: 'sgv', date: { $gt: lastSeenDate } })
        .sort({ date: -1 })
        .limit(10)
        .toArray();

      if (entries.length > 0) {
        // Update cursor to the newest entry seen
        lastSeenDate = Math.max(...entries.map((e) => Number(e.date)));
        // Emit newest entry only
        const newest = entries.reduce((a, b) => (Number(a.date) > Number(b.date) ? a : b));
        io?.emit('glucose:new', {
          type: 'glucose',
          data: newest,
          timestamp: new Date().toISOString(),
        });
      }

      // ── Alarm evaluation (runs on every tick, not only on new entries) ─────
      // This ensures STALE alarms fire even without new glucose arriving.
      try {
        const latest = await db
          .collection<GlucoseEntry>('entries')
          .find({ type: 'sgv' })
          .sort({ date: -1 })
          .limit(1)
          .toArray()
          .then((r) => r[0]);

        if (latest) {
          const recentEntries = await db
            .collection<GlucoseEntry>('entries')
            .find({ type: 'sgv' })
            .sort({ date: -1 })
            .limit(12)
            .toArray();

          const { alarmThresholds, alarmConfig } = await getCachedSettings();
          const alarmEvents = evaluateAlarms(
            latest, recentEntries, alarmThresholds, alarmConfig, getSnoozeMap()
          );

          const apiUrl = `http://localhost:${process.env.PORT ?? 3001}/api`;
          for (const event of alarmEvents) {
            // Set cooldown (30 min) so the same alarm doesn't repeat immediately
            setSnooze(event.type, 30 * 60_000);
            // Emit to connected WebSocket clients (in-app banner + sound)
            io?.emit('alarm', event);
            // Send Web Push to background browsers
            await broadcastAlarm(event, apiUrl);
          }
        }
      } catch {
        // Silently ignore alarm evaluation errors (non-critical)
      }
    } catch {
      // Silently ignore transient polling errors
    }
  };

  pollingIntervalHandle = setInterval(poll, 30_000);
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function broadcastGlucoseUpdate(data: GlucoseEntry) {
  io?.emit('glucose:new', {
    type: 'glucose',
    data,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastTreatmentUpdate(data: Treatment) {
  io?.emit('treatment:new', {
    type: 'treatment',
    data,
    timestamp: new Date().toISOString(),
  });
}
