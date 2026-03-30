import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { canAccessBox } from "@/lib/access";
import { uploadToCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// GET /api/boxes/:id/images
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const boxId = params.id;

  const box = await canAccessBox(userId, boxId);
  if (!box) {
    return NextResponse.json({ error: "Box not found" }, { status: 404 });
  }

  const db = await getDb();
  const images = await db
    .collection("images")
    .find({ box_id: new ObjectId(boxId) })
    .sort({ created_at: -1 })
    .toArray();

  return NextResponse.json(images);
}

// POST /api/boxes/:id/images — upload images via multipart form data
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId(req);
  const boxId = params.id;

  const box = await canAccessBox(userId, boxId);
  if (!box) {
    return NextResponse.json({ error: "Box not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const files = formData.getAll("images") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: "No images provided" },
      { status: 400 }
    );
  }

  if (files.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 images per upload" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const uploaded = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 10 * 1024 * 1024) continue;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { publicId, url } = await uploadToCloudinary(
      buffer,
      `boxes/${boxId}`
    );

    const doc = {
      box_id: new ObjectId(boxId),
      move_id: box.move_id,
      uploaded_by: new ObjectId(userId),
      public_id: publicId,
      url,
      filename: file.name || "image",
      content_type: file.type,
      size: file.size,
      created_at: new Date(),
    };

    const result = await db.collection("images").insertOne(doc);
    uploaded.push({ _id: result.insertedId, ...doc });
  }

  return NextResponse.json(uploaded, { status: 201 });
}
