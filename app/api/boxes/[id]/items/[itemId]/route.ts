import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessBox } from '@/lib/access';

export const dynamic = 'force-dynamic';

// PATCH /api/boxes/:id/items/:itemId — update item (rename or move to another box)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const userId = await getUserId(req);
  if (!(await canAccessBox(userId, params.id))) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name?.trim()) {
    updates.name = body.name.trim();
  }

  if (body.newBoxId) {
    if (!(await canAccessBox(userId, body.newBoxId))) {
      return NextResponse.json({ error: 'Target box not found' }, { status: 404 });
    }
    updates.box_id = new ObjectId(body.newBoxId);
  }

  if (body.imageId !== undefined) {
    updates.image_id = body.imageId ? new ObjectId(body.imageId) : null;
  }

  if (body.unpacked !== undefined) {
    updates.unpacked = !!body.unpacked;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const db = await getDb();
  await db.collection('items').updateOne(
    { _id: new ObjectId(params.itemId), box_id: new ObjectId(params.id) },
    { $set: updates }
  );

  const updated = await db.collection('items').findOne({ _id: new ObjectId(params.itemId) });
  return NextResponse.json(updated);
}

// DELETE /api/boxes/:id/items/:itemId
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const userId = await getUserId(req);
  if (!(await canAccessBox(userId, params.id))) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  const db = await getDb();
  await db.collection('items').deleteOne({
    _id: new ObjectId(params.itemId),
    box_id: new ObjectId(params.id),
  });

  return new NextResponse(null, { status: 204 });
}
