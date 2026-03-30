import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { UpdateMoveSchema } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// GET /api/moves/:id — single move with members
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const db = await getDb();
  const moveId = new ObjectId(params.id);

  const move = await db
    .collection('moves')
    .aggregate([
      { $match: { _id: moveId } },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'move_id',
          as: 'members',
        },
      },
    ])
    .toArray();

  if (move.length === 0) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  // Check user is owner or member
  const m = move[0];
  const userOid = new ObjectId(userId);
  const isOwner = m.owner_id.equals(userOid);
  const isMember = m.members.some(
    (mem: { user_id?: ObjectId }) => mem.user_id && userOid.equals(mem.user_id)
  );

  if (!isOwner && !isMember) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  return NextResponse.json(m);
}

// PATCH /api/moves/:id — only owner can update
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const body = await req.json();
  const parsed = UpdateMoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = await getDb();
  const moveId = new ObjectId(params.id);

  // Verify ownership
  const existing = await db.collection('moves').findOne({ _id: moveId });
  if (!existing || !existing.owner_id.equals(new ObjectId(userId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  // Build update — convert startDate to Date if provided
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.fromAddress !== undefined) update.from_address = parsed.data.fromAddress;
  if (parsed.data.toAddress !== undefined) update.to_address = parsed.data.toAddress;
  if (parsed.data.startDate !== undefined) update.start_date = new Date(parsed.data.startDate);

  const result = await db.collection('moves').findOneAndUpdate(
    { _id: moveId },
    { $set: update },
    { returnDocument: 'after' }
  );

  // When move switches to 'unpacking', batch-update packed/in_transit boxes
  if (parsed.data.status === 'unpacking') {
    await db.collection('boxes').updateMany(
      { move_id: moveId, status: { $in: ['packed', 'in_transit'] } },
      { $set: { status: 'unpacking', updated_at: new Date() } }
    );
  }

  return NextResponse.json(result);
}

// DELETE /api/moves/:id — only owner can delete, cascades everything
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const db = await getDb();
  const moveId = new ObjectId(params.id);

  // Verify ownership
  const existing = await db.collection('moves').findOne({ _id: moveId });
  if (!existing || !existing.owner_id.equals(new ObjectId(userId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  // Get all box IDs for this move to cascade-delete items
  const boxes = await db
    .collection('boxes')
    .find({ move_id: moveId }, { projection: { _id: 1 } })
    .toArray();
  const boxIds = boxes.map((b) => b._id);

  // Cascade delete: items → boxes → members → move
  if (boxIds.length > 0) {
    await db.collection('items').deleteMany({ box_id: { $in: boxIds } });
  }
  await db.collection('boxes').deleteMany({ move_id: moveId });
  await db.collection('members').deleteMany({ move_id: moveId });
  await db.collection('moves').deleteOne({ _id: moveId });

  return new NextResponse(null, { status: 204 });
}
