import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Member colors to assign automatically
const MEMBER_COLORS = [
  '#D4500A', '#2A6649', '#2563EB',
  '#7C3AED', '#C49A00', '#DB2777', '#0891B2',
];

// POST /api/moves/join — join a move using a share code
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const code = body.code?.trim()?.toUpperCase();

  if (!code || code.length < 4) {
    return NextResponse.json(
      { error: 'A valid join code is required' },
      { status: 400 }
    );
  }

  const db = await getDb();
  const userOid = new ObjectId(userId);

  // Find the move with this join code
  const move = await db.collection('moves').findOne({ join_code: code });
  if (!move) {
    return NextResponse.json(
      { error: 'Invalid code. No move found with this code.' },
      { status: 404 }
    );
  }

  // Check if user is already the owner
  if (move.owner_id?.equals(userOid)) {
    return NextResponse.json(
      { error: 'You already own this move' },
      { status: 409 }
    );
  }

  // Check if user is already a member
  const existing = await db.collection('members').findOne({
    move_id: move._id,
    user_id: userOid,
  });
  if (existing) {
    return NextResponse.json(
      { error: 'You have already joined this move' },
      { status: 409 }
    );
  }

  // Get user info for the member record
  const user = await db.collection('users').findOne({ _id: userOid });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Pick a color (based on existing member count)
  const memberCount = await db
    .collection('members')
    .countDocuments({ move_id: move._id });
  const color = MEMBER_COLORS[memberCount % MEMBER_COLORS.length];

  // Create member record linked to user account
  const memberDoc = {
    move_id: move._id,
    user_id: userOid,
    name: user.name || user.email,
    color,
    role: 'member' as const,
    created_at: new Date(),
  };

  await db.collection('members').insertOne(memberDoc);

  // Return the move data
  return NextResponse.json(move, { status: 200 });
}
