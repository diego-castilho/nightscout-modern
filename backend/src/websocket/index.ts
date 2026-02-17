// ============================================================================
// WebSocket Server - Real-time Glucose Updates
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

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Nightscout Modern WebSocket',
      timestamp: new Date().toISOString(),
    });
  });

  // Set up MongoDB Change Streams for real-time updates
  setupChangeStreams();

  console.log('🔌 WebSocket server initialized');

  return io;
}

function setupChangeStreams() {
  try {
    const db = getDatabase();

    // Watch for new glucose entries
    const entriesCollection = db.collection<GlucoseEntry>('entries');
    const entriesChangeStream = entriesCollection.watch(
      [{ $match: { 'fullDocument.type': 'sgv' } }],
      { fullDocument: 'updateLookup' }
    );

    entriesChangeStream.on('change', (change) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        console.log('📊 New glucose entry detected');
        io?.emit('glucose:new', {
          type: 'glucose',
          data: change.fullDocument,
          timestamp: new Date().toISOString(),
        });
      }
    });

    entriesChangeStream.on('error', (error) => {
      console.warn('⚠️  Change Stream error (entries):', error.message);
    });

    // Watch for new treatments
    const treatmentsCollection = db.collection<Treatment>('treatments');
    const treatmentsChangeStream = treatmentsCollection.watch([], {
      fullDocument: 'updateLookup',
    });

    treatmentsChangeStream.on('change', (change) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        console.log('💉 New treatment detected');
        io?.emit('treatment:new', {
          type: 'treatment',
          data: change.fullDocument,
          timestamp: new Date().toISOString(),
        });
      }
    });

    treatmentsChangeStream.on('error', (error) => {
      console.warn('⚠️  Change Stream error (treatments):', error.message);
    });

    // Watch for device status updates
    const deviceStatusCollection = db.collection<DeviceStatus>('devicestatus');
    const deviceStatusChangeStream = deviceStatusCollection.watch([], {
      fullDocument: 'updateLookup',
    });

    deviceStatusChangeStream.on('change', (change) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        console.log('📱 New device status detected');
        io?.emit('deviceStatus:new', {
          type: 'deviceStatus',
          data: change.fullDocument,
          timestamp: new Date().toISOString(),
        });
      }
    });

    deviceStatusChangeStream.on('error', (error) => {
      console.warn('⚠️  Change Stream error (devicestatus):', error.message);
    });

    console.log('👁️  MongoDB Change Streams active (real-time updates enabled)');
  } catch (error: any) {
    console.warn('⚠️  MongoDB Change Streams not available (requires replica set)');
    console.warn('💡 Real-time updates disabled. Frontend will use polling instead.');
  }
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
