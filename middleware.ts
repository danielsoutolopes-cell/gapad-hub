import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const allCookies = request.cookies.getAll();
    const hasSupabaseSession = allCookies.some(
      (c) =>
        (c.name.startsWith('sb-') && c.name.includes('-auth-token') && Boolean(c.value)) ||
        (c.name === 'gadap-auth-token' && Boolean(c.value))
    );

    if (!hasSupabaseSession) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/dashboard'],
};

