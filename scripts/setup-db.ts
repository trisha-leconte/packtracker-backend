/**
 * MongoDB Setup Script
 * Creates collections, indexes, and seed data for PackTrack.
 *
 * Usage:
 *   npx tsx scripts/setup-db.ts
 *
 * Requires MONGODB_URI env var (reads from .env.local automatically via --env-file).
 */

import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'packtrack';

if (!uri) {
  console.error('Error: MONGODB_URI environment variable is required.');
  console.error('Set it in .env.local or pass it directly.');
  process.exit(1);
}

async function setup() {
  const client = new MongoClient(uri!);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    // =====================
    // Create Collections
    // =====================
    const existing = await db.listCollections().toArray();
    const existingNames = existing.map((c) => c.name);

    for (const name of ['moves', 'members', 'boxes', 'items', 'users', 'images', 'rooms', 'checklists', 'activities', 'inspections']) {
      if (!existingNames.includes(name)) {
        await db.createCollection(name);
        console.log(`Created collection: ${name}`);
      } else {
        console.log(`Collection already exists: ${name}`);
      }
    }

    // =====================
    // Create Indexes
    // =====================
    const movesCol = db.collection('moves');
    await movesCol.createIndex({ owner_id: 1 });
    await movesCol.createIndex({ join_code: 1 }, { unique: true, sparse: true });
    console.log('Indexes: moves.owner_id, moves.join_code (unique, sparse)');

    const members = db.collection('members');
    await members.createIndex({ move_id: 1 });
    await members.createIndex({ user_id: 1 });
    console.log('Indexes: members.move_id, members.user_id');

    const boxes = db.collection('boxes');
    await boxes.createIndex({ move_id: 1 });
    await boxes.createIndex({ creator_id: 1 });
    await boxes.createIndex({ room: 1 });
    console.log('Indexes: boxes.move_id, boxes.creator_id, boxes.room');

    const items = db.collection('items');
    await items.createIndex({ box_id: 1 });
    await items.createIndex({ name: 'text' }); // full-text search index
    console.log('Indexes: items.box_id, items.name (text)');

    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    console.log('Index: users.email (unique)');

    const images = db.collection('images');
    await images.createIndex({ box_id: 1 });
    await images.createIndex({ move_id: 1 });
    console.log('Indexes: images.box_id, images.move_id');

    const checklists = db.collection('checklists');
    await checklists.createIndex({ move_id: 1 });
    console.log('Index: checklists.move_id');

    const activities = db.collection('activities');
    await activities.createIndex({ move_id: 1, created_at: -1 });
    console.log('Index: activities.move_id + created_at');

    // =====================
    // Seed: Default Move
    // =====================
    const moves = db.collection('moves');
    const seedId = new ObjectId('000000000000000000000001');
    const existingMove = await moves.findOne({ _id: seedId });

    if (!existingMove) {
      await moves.insertOne({
        _id: seedId,
        name: 'My Move',
        created_at: new Date(),
      });
      console.log(`Seeded move: "My Move" (id: ${seedId.toHexString()})`);
    } else {
      console.log(`Seed move already exists: ${seedId.toHexString()}`);
    }

    console.log('\nSetup complete!');
    console.log(`Database: ${dbName}`);
    console.log(`Default move ID: ${seedId.toHexString()}`);
    console.log('Set PACKTRACK_MOVE_ID in .env.local to this value.');
  } finally {
    await client.close();
  }
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
