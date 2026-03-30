import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessBox } from '@/lib/access';
import { AddItemsSchema } from '@/lib/validate';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

// GET /api/boxes/:id/items
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  if (!(await canAccessBox(userId, params.id))) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  const db = await getDb();
  const items = await db
    .collection('items')
    .find({ box_id: new ObjectId(params.id) })
    .sort({ created_at: 1 })
    .toArray();

  return NextResponse.json(items);
}

// POST /api/boxes/:id/items — bulk-add items
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  if (!(await canAccessBox(userId, params.id))) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = AddItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const boxId = new ObjectId(params.id);
  const now = new Date();
  const imageId = body.imageId || null;
  const docs = parsed.data.names.map((name) => ({
    box_id: boxId,
    name,
    image_id: imageId ? new ObjectId(imageId) : null,
    added_by: new ObjectId(userId),
    created_at: now,
  }));

  const db = await getDb();
  const result = await db.collection('items').insertMany(docs);

  const inserted = docs.map((doc, i) => ({
    _id: result.insertedIds[i],
    ...doc,
  }));

  // Get move_id from box for activity logging
  const boxDoc = await db.collection('boxes').findOne({ _id: boxId });
  if (boxDoc) {
    logActivity({
      moveId: boxDoc.move_id, actorId: userId, action: 'item_added',
      entityType: 'item', entityId: boxId.toHexString(),
      metadata: { count: docs.length, boxLabel: boxDoc.label },
    });
  }

  return NextResponse.json(inserted, { status: 201 });
}
