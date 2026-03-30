import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessMove } from '@/lib/access';

export const dynamic = 'force-dynamic';

// GET /api/activities?moveId=xxx&limit=50&before=<objectId>
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const { searchParams } = req.nextUrl;
  const moveId = searchParams.get('moveId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const before = searchParams.get('before');

  if (!moveId) {
    return NextResponse.json({ error: 'moveId required' }, { status: 400 });
  }

  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const db = await getDb();
  const filter: Record<string, unknown> = { move_id: new ObjectId(moveId) };
  if (before) {
    filter._id = { $lt: new ObjectId(before) };
  }

  const activities = await db
    .collection('activities')
    .aggregate([
      { $match: filter },
      { $sort: { created_at: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'members',
          localField: 'actor_id',
          foreignField: '_id',
          as: 'actor',
        },
      },
      { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'actor_id',
          foreignField: '_id',
          as: 'user_actor',
        },
      },
      { $unwind: { path: '$user_actor', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          actor_name: {
            $ifNull: ['$actor.name', { $ifNull: ['$user_actor.name', 'Someone'] }],
          },
          actor_color: {
            $ifNull: ['$actor.color', '#6B6560'],
          },
        },
      },
      { $project: { actor: 0, user_actor: 0 } },
    ])
    .toArray();

  return NextResponse.json(activities);
}
