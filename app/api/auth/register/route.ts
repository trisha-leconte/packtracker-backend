import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { signToken } from '@/lib/auth';
import { RegisterSchema } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// POST /api/auth/register
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { email, password, name } = parsed.data;
  const db = await getDb();
  const users = db.collection('users');

  // Check if email already exists
  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const doc = {
    email: email.toLowerCase(),
    password: hashedPassword,
    name,
    created_at: new Date(),
  };

  const result = await users.insertOne(doc);
  const token = await signToken({
    userId: result.insertedId.toHexString(),
    email: doc.email,
  });

  return NextResponse.json(
    {
      token,
      user: {
        _id: result.insertedId,
        email: doc.email,
        name: doc.name,
      },
    },
    { status: 201 }
  );
}
