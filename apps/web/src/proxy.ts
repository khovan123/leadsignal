import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intl = createMiddleware({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'always',
});
const apiUrl =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

function localeOf(pathname: string) {
  const value = pathname.split('/')[1];
  return value === 'en' ? 'en' : 'vi';
}

function isPublic(pathname: string) {
  return /^\/(vi|en)\/(login|register|invite)(\/|$)/.test(pathname);
}

function expiresSoon(token: string | undefined) {
  if (!token) return true;
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(atob(normalized)) as { exp?: number };
    return !data.exp || data.exp <= Math.floor(Date.now() / 1000) + 30;
  } catch {
    return true;
  }
}

function setSession(
  response: NextResponse,
  session: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: { workspaceId?: string };
  },
) {
  const secure = process.env.NODE_ENV === 'production';
  const refreshAge = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86400;

  response.cookies.set('ls_access', session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: session.expiresIn,
  });
  response.cookies.set('ls_refresh', session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: refreshAge,
  });
  if (session.user.workspaceId) {
    response.cookies.set('ls_workspace', session.user.workspaceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: refreshAge,
    });
  }
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isPublic(pathname)) return intl(request);

  const access = request.cookies.get('ls_access')?.value;
  if (!expiresSoon(access)) return intl(request);

  const refresh = request.cookies.get('ls_refresh')?.value;
  if (!refresh) {
    return NextResponse.redirect(
      new URL(`/${localeOf(pathname)}/login`, request.url),
    );
  }

  try {
    const refreshed = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: 'no-store',
    });
    if (!refreshed.ok) throw new Error('refresh rejected');

    const session = (await refreshed.json()) as {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: { workspaceId?: string };
    };

    request.cookies.set('ls_access', session.accessToken);
    request.cookies.set('ls_refresh', session.refreshToken);
    if (session.user.workspaceId) {
      request.cookies.set('ls_workspace', session.user.workspaceId);
    }

    const response = intl(request);
    setSession(response, session);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL(`/${localeOf(pathname)}/login`, request.url),
    );
    response.cookies.delete('ls_access');
    response.cookies.delete('ls_refresh');
    response.cookies.delete('ls_workspace');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
