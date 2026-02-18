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

    // Ensure indexes for fast analytics queries
    await ensureIndexes(db);

    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Ensures the compound index {type, date} exists on the entries collection.
// createIndex() is a no-op if the index already exists, so this is safe to
// run on every startup. The index is critical for fast analytics over long
// date ranges (7d/14d/30d) on large Nightscout databases.
async function ensureIndexes(database: Db): Promise<void> {
  try {
    await database.collection('entries').createIndex(
      { type: 1, date: 1 },
      { background: true, name: 'idx_type_date' }
    );
    console.log('📑 Indexes verified (entries: type+date)');
  } catch (error: any) {
    // Non-fatal — queries will still work, just slower
    console.warn('⚠️  Could not ensure indexes:', error.message);
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
