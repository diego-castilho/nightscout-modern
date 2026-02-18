// ============================================================================
// WebSocket Server - Real-time Glucose Updates
// Falls back to 30-second polling when MongoDB Change Streams are unavailable
// (Change Streams require a replica set; standalone MongoDB is polling-only)
// ============================================================================

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { getDatabase } from '../db/connection.js';
import type { GlucoseEntry, Treatment, DeviceStatus } from '../types/index.js';

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
  } catch (error: any) {
    console.warn('⚠️  Could not set up Change Streams:', error.message);
    startPollingFallback();
  }
}

// ============================================================================
// Polling fallback — used when MongoDB is standalone (no replica set)
// Checks for new glucose entries every 30 seconds and emits via WebSocket.
// ============================================================================
function startPollingFallback() {
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
    } catch {
      // Silently ignore transient polling errors
    }
  };

  setInterval(poll, 30_000);
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
