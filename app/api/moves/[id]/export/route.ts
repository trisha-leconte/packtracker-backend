import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getUserId } from '@/lib/auth';
import { canAccessMove } from '@/lib/access';

export const dynamic = 'force-dynamic';

const TAG_LABELS: Record<string, string> = {
  open_first: 'Open First',
  fragile: 'Fragile',
  heavy: 'Heavy',
  essentials: 'Essentials',
  donate: 'Donate',
};

function sizeLabel(size: any): string {
  if (!size) return '';
  if (size.type === 'custom') return `${size.length}×${size.width}×${size.height}`;
  return size.type;
}

// GET /api/moves/:id/export
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const moveId = params.id;

  if (!(await canAccessMove(userId, moveId))) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const db = await getDb();
  const moveOid = new ObjectId(moveId);

  const move = await db.collection('moves').findOne({ _id: moveOid });
  if (!move) {
    return NextResponse.json({ error: 'Move not found' }, { status: 404 });
  }

  const boxes = await db
    .collection('boxes')
    .aggregate([
      { $match: { move_id: moveOid } },
      {
        $lookup: {
          from: 'items',
          localField: '_id',
          foreignField: 'box_id',
          as: 'items',
        },
      },
      {
        $lookup: {
          from: 'members',
          localField: 'creator_id',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      { $sort: { room: 1, label: 1 } },
    ])
    .toArray();

  const members = await db
    .collection('members')
    .find({ move_id: moveOid })
    .toArray();

  // Group boxes by room
  const rooms: Record<string, typeof boxes> = {};
  for (const box of boxes) {
    const room = box.room || 'Other';
    if (!rooms[room]) rooms[room] = [];
    rooms[room].push(box);
  }

  const totalBoxes = boxes.length;
  const totalItems = boxes.reduce((s, b) => s + (b.items?.length || 0), 0);
  const packedBoxes = boxes.filter((b) => b.status === 'packed').length;

  const statusLabel = (s: string) =>
    s === 'packed' ? 'Packed' : s === 'in_transit' ? 'In Transit' : 'Packing';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${move.name} — BoxBoss Manifest</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; color: #1A1612; padding: 24px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .subtitle { color: #6B6560; font-size: 14px; margin-bottom: 20px; }
  .stats { display: flex; gap: 16px; margin-bottom: 24px; }
  .stat { background: #F5F0E8; border-radius: 8px; padding: 12px 16px; flex: 1; }
  .stat-num { font-size: 24px; font-weight: 700; }
  .stat-label { font-size: 12px; color: #6B6560; }
  .room-header { font-size: 18px; font-weight: 700; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #E0D9CE; }
  .box { border: 1px solid #E0D9CE; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .box-label { font-size: 16px; font-weight: 600; }
  .box-meta { font-size: 12px; color: #6B6560; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .badge-packed { background: #DFF0E8; color: #2A6649; }
  .badge-unpacked { background: #FFF6D6; color: #C49A00; }
  .badge-in_transit { background: #FFE8DC; color: #D4500A; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; margin-right: 4px; background: #F0F0F0; }
  .items-list { margin-top: 8px; padding-left: 16px; }
  .items-list li { font-size: 13px; margin-bottom: 3px; }
  .notes { margin-top: 6px; font-size: 12px; color: #6B6560; font-style: italic; }
  .members { margin-bottom: 20px; }
  .member { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 12px; margin-right: 6px; margin-bottom: 4px; }
  .footer { margin-top: 32px; text-align: center; color: #6B6560; font-size: 11px; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <h1>${move.name}</h1>
  <div class="subtitle">
    ${move.from_address ? `From: ${move.from_address}` : ''}
    ${move.to_address ? ` → To: ${move.to_address}` : ''}
    ${move.start_date ? ` · ${new Date(move.start_date).toLocaleDateString()}` : ''}
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-num">${totalBoxes}</div><div class="stat-label">Boxes</div></div>
    <div class="stat"><div class="stat-num">${packedBoxes}</div><div class="stat-label">Packed</div></div>
    <div class="stat"><div class="stat-num">${totalItems}</div><div class="stat-label">Items</div></div>
  </div>

  <div class="members">
    <strong>Members:</strong>
    ${members.map((m) => `<span class="member" style="background:${m.color}20;color:${m.color}">${m.name}</span>`).join('')}
  </div>

  ${Object.entries(rooms)
    .map(
      ([room, roomBoxes]) => `
    <div class="room-header">${room}</div>
    ${roomBoxes
      .map(
        (box) => `
      <div class="box">
        <div class="box-header">
          <span class="box-label">${box.label} ${box.size ? `<span class="box-meta">(${sizeLabel(box.size)})</span>` : ''}</span>
          <span class="badge badge-${box.status}">${statusLabel(box.status)}</span>
        </div>
        <div class="box-meta">
          ${box.creator?.name ? `Packed by ${box.creator.name}` : ''} · ${box.items?.length || 0} items
        </div>
        ${(box.tags || []).length > 0 ? `<div style="margin-top:4px">${box.tags.map((t: string) => `<span class="tag">${TAG_LABELS[t] || t}</span>`).join('')}</div>` : ''}
        ${box.notes ? `<div class="notes">${box.notes}</div>` : ''}
        ${
          box.items && box.items.length > 0
            ? `<ul class="items-list">${box.items.map((item: any) => `<li>${item.name}</li>`).join('')}</ul>`
            : ''
        }
      </div>`
      )
      .join('')}
  `
    )
    .join('')}

  <div class="footer">Generated by BoxBoss · ${new Date().toLocaleDateString()}</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
