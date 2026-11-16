import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

// Desktop shell handshake: the shell sends a random nonce and accepts the server only
// if it answers HMAC-SHA256(APP_TOKEN, nonce). A process squatting on the port can't.
export async function GET(request: NextRequest) {
  const token = process.env.APP_TOKEN;
  const nonce = request.nextUrl.searchParams.get('nonce') ?? '';
  if (!token || !/^[0-9a-f]{32,128}$/.test(nonce)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  return NextResponse.json({ proof: createHmac('sha256', token).update(nonce).digest('hex') });
}
