import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessMove } from '@/lib/access';
import { CreateChecklistItemSchema } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// GET /api/checklists?moveId=xxx
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
  const items = await db
    .collection('checklists')
    .find({ move_id: new ObjectId(moveId) })
    .sort({ created_at: 1 })
    .toArray();

  return NextResponse.json(items);
}

// POST /api/checklists
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const parsed = CreateChecklistItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { moveId, text } = parsed.data;
  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const db = await getDb();
  const doc = {
    move_id: new ObjectId(moveId),
    text,
    checked: false,
    created_by: new ObjectId(userId),
    created_at: new Date(),
  };

  const result = await db.collection('checklists').insertOne(doc);
  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 });
}
