import { NextResponse } from 'next/server';

// Lets the desktop shell verify that the server on the port is its own child process.
export async function GET() {
  return NextResponse.json({ pid: process.pid });
}
