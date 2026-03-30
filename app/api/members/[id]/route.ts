import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// DELETE /api/members/:id — owner can remove anyone, member can remove themselves
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const memberId = params.id;
  const db = await getDb();
  const userOid = new ObjectId(userId);

  // Find the member record
  const member = await db
    .collection('members')
    .findOne({ _id: new ObjectId(memberId) });

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Find the move to check ownership
  const move = await db
    .collection('moves')
    .findOne({ _id: member.move_id });

  if (!move) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const isOwner = move.owner_id?.equals(userOid);
  const isSelf = member.user_id?.equals(userOid);

  // Owner can remove anyone; members can only remove themselves
  if (!isOwner && !isSelf) {
    return NextResponse.json(
      { error: 'Only the move owner or the member themselves can do this' },
      { status: 403 }
    );
  }

  await db.collection('members').deleteOne({ _id: new ObjectId(memberId) });

  return new NextResponse(null, { status: 204 });
}
