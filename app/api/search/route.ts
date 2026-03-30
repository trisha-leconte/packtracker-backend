import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessMove } from '@/lib/access';

export const dynamic = 'force-dynamic';

// GET /api/search?q=french+press&moveId=xxx
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim();
  const moveId = searchParams.get('moveId');

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }
  if (!moveId) {
    return NextResponse.json({ error: 'moveId required' }, { status: 400 });
  }

  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const db = await getDb();

  const results = await db
    .collection('items')
    .aggregate([
      {
        $match: {
          $text: { $search: q },
        },
      },
      { $addFields: { score: { $meta: 'textScore' } } },
      {
        $lookup: {
          from: 'boxes',
          localField: 'box_id',
          foreignField: '_id',
          as: 'box',
        },
      },
      { $unwind: '$box' },
      { $match: { 'box.move_id': new ObjectId(moveId) } },
      {
        $project: {
          item_id: '$_id',
          item_name: '$name',
          box_id: '$box._id',
          box_label: '$box.label',
          room: '$box.room',
          status: '$box.status',
          creator_id: '$box.creator_id',
          score: 1,
        },
      },
      { $sort: { score: -1 } },
      { $limit: 50 },
    ])
    .toArray();

  return NextResponse.json(results);
}
