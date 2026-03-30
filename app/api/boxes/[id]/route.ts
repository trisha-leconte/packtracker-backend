import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessBox } from '@/lib/access';
import { UpdateBoxSchema } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// GET /api/boxes/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  if (!(await canAccessBox(userId, params.id))) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  const db = await getDb();
  const boxes = await db
    .collection('boxes')
    .aggregate([
      { $match: { _id: new ObjectId(params.id) } },
      {
        $lookup: {
          from: 'members',
          localField: 'creator_id',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'items',
          localField: '_id',
          foreignField: 'box_id',
          as: 'items',
        },
      },
      {
        $addFields: {
          creator: {
            _id: '$creator._id',
            name: '$creator.name',
            color: '$creator.color',
          },
        },
      },
    ])
    .toArray();

  if (boxes.length === 0) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  return NextResponse.json(boxes[0]);
}

// PATCH /api/boxes/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  if (!(await canAccessBox(userId, params.id))) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = UpdateBoxSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection('boxes').findOneAndUpdate(
    { _id: new ObjectId(params.id) },
    { $set: { ...parsed.data, updated_at: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  return NextResponse.json(result);
}

// DELETE /api/boxes/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  if (!(await canAccessBox(userId, params.id))) {
    return NextResponse.json({ error: 'Box not found' }, { status: 404 });
  }

  const db = await getDb();
  const boxId = new ObjectId(params.id);

  await db.collection('items').deleteMany({ box_id: boxId });
  await db.collection('boxes').deleteOne({ _id: boxId });

  return new NextResponse(null, { status: 204 });
}
