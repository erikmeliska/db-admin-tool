import { NextResponse } from 'next/server';

// Non-secret server capabilities the UI adapts to. Never return the values themselves.
export async function GET() {
  return NextResponse.json({
    proxyFromEnv: Boolean(process.env.IM_DB_PROXY_URL && process.env.IM_DB_PROXY_AUTH),
  });
}
