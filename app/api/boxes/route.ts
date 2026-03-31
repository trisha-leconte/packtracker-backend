import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessMove, isValidMember } from '@/lib/access';
import { CreateBoxSchema } from '@/lib/validate';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

// GET /api/boxes?moveId=xxx&creatorId=xxx&status=packed
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const { searchParams } = req.nextUrl;
  const moveId = searchParams.get('moveId');
  const creatorId = searchParams.get('creatorId');
  const status = searchParams.get('status');

  if (!moveId) {
    return NextResponse.json({ error: 'moveId required' }, { status: 400 });
  }

  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const db = await getDb();

  const filter: Record<string, unknown> = { move_id: new ObjectId(moveId) };
  if (creatorId) filter.creator_id = new ObjectId(creatorId);
  if (status) filter.status = status;

  const boxes = await db
    .collection('boxes')
    .aggregate([
      { $match: filter },
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
          as: '_items',
        },
      },
      {
        $addFields: {
          item_count: { $size: '$_items' },
          items_unpacked: {
            $size: {
              $filter: { input: '$_items', as: 'i', cond: { $eq: ['$$i.unpacked', true] } },
            },
          },
          creator: {
            _id: '$creator._id',
            name: '$creator.name',
            color: '$creator.color',
          },
        },
      },
      { $project: { _items: 0 } },
      { $sort: { room: 1, created_at: 1 } },
    ])
    .toArray();

  return NextResponse.json(boxes);
}

// POST /api/boxes
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const parsed = CreateBoxSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { moveId, label, room, size, tags, notes, is_loose } = parsed.data;

  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const db = await getDb();
  const userOid = new ObjectId(userId);
  const moveOid = new ObjectId(moveId);

  // Find the member record for the logged-in user
  let creator = await db.collection('members').findOne(
    { move_id: moveOid, user_id: userOid },
    { projection: { _id: 1, name: 1, color: 1 } }
  );

  // If user has no member record, auto-create one
  if (!creator) {
    const user = await db.collection('users').findOne({ _id: userOid });
    const memberDoc = {
      move_id: moveOid,
      user_id: userOid,
      name: user?.name || 'Unknown',
      color: '#D4500A',
      role: 'member',
      created_at: new Date(),
    };
    const memberResult = await db.collection('members').insertOne(memberDoc);
    creator = { _id: memberResult.insertedId, name: memberDoc.name, color: memberDoc.color };
  }

  const now = new Date();
  const doc = {
    move_id: moveOid,
    creator_id: creator._id,
    label,
    room,
    size,
    tags: tags || [],
    notes: notes || '',
    is_loose: is_loose || false,
    status: 'unpacked' as const,
    created_at: now,
    updated_at: now,
  };

  const result = await db.collection('boxes').insertOne(doc);

  logActivity({
    moveId, actorId: userId, action: 'box_created',
    entityType: 'box', entityId: result.insertedId.toHexString(),
    metadata: { label, room },
  });

  return NextResponse.json(
    { _id: result.insertedId, ...doc, creator },
    { status: 201 }
  );
}
