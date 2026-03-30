import { ObjectId } from 'mongodb';
import { getDb } from './mongodb';

export type ActivityAction =
  | 'box_created'
  | 'box_deleted'
  | 'status_changed'
  | 'item_added'
  | 'item_deleted'
  | 'photo_uploaded'
  | 'member_joined'
  | 'item_unpacked'
  | 'box_completed';

interface LogActivityParams {
  moveId: string | ObjectId;
  actorId: string | ObjectId;
  action: ActivityAction;
  entityType: 'box' | 'item' | 'image' | 'member';
  entityId: string | ObjectId;
  metadata?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams) {
  try {
    const db = await getDb();
    await db.collection('activities').insertOne({
      move_id: new ObjectId(params.moveId),
      actor_id: new ObjectId(params.actorId),
      action: params.action,
      entity_type: params.entityType,
      entity_id: new ObjectId(params.entityId),
      metadata: params.metadata || {},
      created_at: new Date(),
    });
  } catch (e) {
    // Fire and forget — don't break the main request
    console.error('Failed to log activity:', e);
  }
}
