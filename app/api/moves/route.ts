import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { CreateMoveSchema } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// GET /api/moves — list moves the user owns or is a member of
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const db = await getDb();
  const userOid = new ObjectId(userId);

  // Find moves where user is owner
  const ownedMoves = await db
    .collection('moves')
    .find({ owner_id: userOid })
    .sort({ created_at: -1 })
    .toArray();

  // Find moves where user is a member (by matching member email or user_id)
  const memberMoves = await db
    .collection('moves')
    .aggregate([
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'move_id',
          as: 'members',
        },
      },
      {
        $match: {
          owner_id: { $ne: userOid },
          'members.user_id': userOid,
        },
      },
      { $project: { members: 0 } },
      { $sort: { created_at: -1 } },
    ])
    .toArray();

  return NextResponse.json([...ownedMoves, ...memberMoves]);
}

// POST /api/moves
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const parsed = CreateMoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { name, startDate, targetDate, fromAddress, toAddress } = parsed.data;
  const doc = {
    owner_id: new ObjectId(userId),
    name,
    start_date: new Date(startDate),
    target_date: targetDate ? new Date(targetDate) : null,
    from_address: fromAddress || null,
    to_address: toAddress || null,
    status: 'planning' as const,
    created_at: new Date(),
  };

  const db = await getDb();
  const result = await db.collection('moves').insertOne(doc);

  // Auto-create owner as a member
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  await db.collection('members').insertOne({
    move_id: result.insertedId,
    user_id: new ObjectId(userId),
    name: user?.name || 'Owner',
    color: '#D4500A',
    role: 'owner',
    created_at: new Date(),
  });

  // Auto-create default checklist items
  const now = new Date();
  const defaultChecklist = [
    'Add move-in inspection',
    'Check out Moving Tips in menu',
    'Add members to your move',
    'Set up rooms',
    'Forward mail to new address',
    'Transfer or cancel utilities',
  ];
  await db.collection('checklists').insertMany(
    defaultChecklist.map((text) => ({
      move_id: result.insertedId,
      text,
      checked: false,
      created_by: new ObjectId(userId),
      created_at: now,
    }))
  );

  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 });
}
