import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_OPTIONS } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // maxAge: 0 expires the cookie immediately. Same NextResponse.cookies
  // mechanism as login (see the note there) with the exact same
  // attributes login used to set it — a Set-Cookie with a different
  // path/sameSite than the original is a no-op as far as the browser is
  // concerned, so it clears nothing.
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    ...ADMIN_COOKIE_OPTIONS,
    maxAge: 0,
  });

  return response;
}
