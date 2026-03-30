import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function generateCode(): string {
  // 6-char uppercase alphanumeric, easy to read/type
  return crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

// GET /api/moves/:id/join-code — get existing join code for a move
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const moveId = params.id;
  const db = await getDb();

  const move = await db
    .collection('moves')
    .findOne({ _id: new ObjectId(moveId) });

  if (!move) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  // Only owner or members can view the join code
  const userOid = new ObjectId(userId);
  const isOwner = move.owner_id?.equals(userOid);
  if (!isOwner) {
    const member = await db.collection('members').findOne({
      move_id: new ObjectId(moveId),
      user_id: userOid,
    });
    if (!member) {
      return NextResponse.json({ error: 'Move not found' }, { status: 404 });
    }
  }

  return NextResponse.json({ joinCode: move.join_code || null });
}

// POST /api/moves/:id/join-code — generate a join code (owner only)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const moveId = params.id;
  const db = await getDb();

  const move = await db
    .collection('moves')
    .findOne({ _id: new ObjectId(moveId) });

  if (!move || !move.owner_id?.equals(new ObjectId(userId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  // If a code already exists, return it
  if (move.join_code) {
    return NextResponse.json({ joinCode: move.join_code });
  }

  // Generate a unique code
  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db
      .collection('moves')
      .findOne({ join_code: code });
    if (!existing) break;
    code = generateCode();
    attempts++;
  }

  // Store the code on the move document
  await db
    .collection('moves')
    .updateOne({ _id: new ObjectId(moveId) }, { $set: { join_code: code } });

  return NextResponse.json({ joinCode: code }, { status: 201 });
}
