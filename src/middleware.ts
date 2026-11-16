import { NextRequest, NextResponse } from 'next/server';

// Local-only app guard for every route:
//  - Host must be loopback (blocks DNS rebinding)
//  - cross-origin browser requests to /api are rejected (CSRF)
//  - desktop app: APP_TOKEN is a per-launch secret from the Tauri shell. The window opens
//    /?launch=<token>, which sets an httpOnly cookie; /api then requires that cookie or the
//    X-App-Token header, so other local processes and web pages can't use the API.
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
const COOKIE = 'app_token';

function hostname(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return null;
  }
}

function forbidden(request: NextRequest, reason: string) {
  console.warn(`[guard] 403 ${reason}: ${request.method} ${request.nextUrl.pathname}`);
  return new NextResponse('Forbidden', { status: 403 });
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  if (!LOCAL.has(hostname(host) ?? '')) return forbidden(request, 'host');

  const origin = request.headers.get('origin');
  if (origin && (!LOCAL.has(hostname(origin) ?? '') || new URL(origin).host !== host)) return forbidden(request, 'origin');

  const token = process.env.APP_TOKEN;
  if (!token) return NextResponse.next();

  const launch = request.nextUrl.searchParams.get('launch');
  if (launch !== null) {
    if (launch !== token) return forbidden(request, 'launch token');
    // Client-side hop instead of a redirect: NextResponse.redirect normalizes 127.0.0.1 to
    // localhost and middleware rejects relative Locations; a different host would move the
    // cookie and localStorage to another origin.
    const params = new URLSearchParams(request.nextUrl.search);
    params.delete('launch');
    const query = params.toString();
    const target = JSON.stringify(`${request.nextUrl.pathname}${query ? `?${query}` : ''}`);
    const res = new NextResponse(
      `<!doctype html><meta charset="utf-8"><script>location.replace(${target.replace(/</g, '\\u003c')})</script>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }
    );
    res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'strict', path: '/' });
    return res;
  }

  // launch-check only returns the pid; the shell calls it without the token so the
  // token is never sent to a process that merely squats on the port.
  if (request.nextUrl.pathname.startsWith('/api/') && request.nextUrl.pathname !== '/api/launch-check') {
    const presented = request.cookies.get(COOKIE)?.value ?? request.headers.get('x-app-token');
    if (presented !== token) return forbidden(request, 'api token');
  }
  return NextResponse.next();
}

export const config = { matcher: '/:path*' };
