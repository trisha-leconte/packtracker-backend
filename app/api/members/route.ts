import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessMove } from '@/lib/access';
import { CreateMemberSchema } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// GET /api/members?moveId=xxx
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const moveId = req.nextUrl.searchParams.get('moveId');
  if (!moveId) {
    return NextResponse.json({ error: 'moveId required' }, { status: 400 });
  }

  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const db = await getDb();
  const members = await db
    .collection('members')
    .find({ move_id: new ObjectId(moveId) })
    .sort({ created_at: 1 })
    .toArray();

  return NextResponse.json(members);
}

// POST /api/members — only move owner can add members
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const parsed = CreateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { moveId, name, color } = parsed.data;

  // Verify user is the move owner
  const db = await getDb();
  const move = await db.collection('moves').findOne({ _id: new ObjectId(moveId) });
  if (!move || !move.owner_id.equals(new ObjectId(userId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const doc = {
    move_id: new ObjectId(moveId),
    name,
    color,
    created_at: new Date(),
  };

  const result = await db.collection('members').insertOne(doc);

  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 });
}
