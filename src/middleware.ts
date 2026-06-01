import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userCookie = request.cookies.get('ljk_user')?.value;

  // Defined protected routes
  const protectedPaths = ['/', '/inventory', '/requests', '/reports', '/settings'];
  
  const isProtected = protectedPaths.some(path => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  });

  if (isProtected && !userCookie) {
    // Redirect unauthenticated user to login screen
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/login') && userCookie) {
    // Redirect authenticated user away from login to dashboard
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
