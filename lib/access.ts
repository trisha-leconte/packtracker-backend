import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

/**
 * Check if a user (by userId) is the owner of a move or a member of it.
 * Returns true if access is allowed.
 */
export async function canAccessMove(
  userId: string,
  moveId: string
): Promise<boolean> {
  const db = await getDb();
  const moveOid = new ObjectId(moveId);
  const userOid = new ObjectId(userId);

  const move = await db.collection('moves').findOne({ _id: moveOid });
  if (!move) return false;

  // Owner always has access
  if (move.owner_id && move.owner_id.equals(userOid)) return true;

  // Check if user is a member
  const member = await db.collection('members').findOne({
    move_id: moveOid,
    user_id: userOid,
  });

  return !!member;
}

/**
 * Check if a creatorId is a valid member within the given move.
 */
export async function isValidMember(
  creatorId: string,
  moveId: string
): Promise<boolean> {
  const db = await getDb();
  const member = await db.collection('members').findOne({
    _id: new ObjectId(creatorId),
    move_id: new ObjectId(moveId),
  });
  return !!member;
}

/**
 * Look up a box and check if the user can access its move.
 * Returns the box document if access is allowed, null otherwise.
 */
export async function canAccessBox(
  userId: string,
  boxId: string
): Promise<{ move_id: ObjectId } | null> {
  const db = await getDb();
  const box = await db
    .collection('boxes')
    .findOne({ _id: new ObjectId(boxId) });
  if (!box) return null;

  const allowed = await canAccessMove(userId, box.move_id.toHexString());
  return allowed ? (box as unknown as { move_id: ObjectId }) : null;
}
