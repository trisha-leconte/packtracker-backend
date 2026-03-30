import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET environment variable');
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: { userId: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as { userId: string; email: string };
}

export async function getUserId(req: NextRequest): Promise<string> {
  const token = req.headers.get('authorization')!.slice(7);
  const { userId } = await verifyToken(token);
  return userId;
}
