import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { signToken } from '@/lib/auth';
import { LoginSchema } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// POST /api/auth/login
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { email, password } = parsed.data;
  const db = await getDb();

  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = await signToken({
    userId: user._id.toHexString(),
    email: user.email,
  });

  return NextResponse.json({
    token,
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
    },
  });
}
