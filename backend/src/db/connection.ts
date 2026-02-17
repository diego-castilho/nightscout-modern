// ============================================================================
// MongoDB Connection Manager
// ============================================================================

import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

interface ConnectionConfig {
  uri: string;
  dbName: string;
  user?: string;
  password?: string;
}

export async function connectToDatabase(config: ConnectionConfig): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    // Build connection URI with credentials if provided
    let connectionUri = config.uri;

    if (config.user && config.password) {
      const url = new URL(config.uri);
      url.username = config.user;
      url.password = config.password;
      connectionUri = url.toString();
    }

    console.log('🔌 Connecting to MongoDB...');

    client = new MongoClient(connectionUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();

    db = client.db(config.dbName);

    // Test connection
    await db.command({ ping: 1 });

    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${config.dbName}`);

    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔌 MongoDB connection closed');
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});
