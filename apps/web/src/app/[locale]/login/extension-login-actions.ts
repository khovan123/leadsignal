'use server';

import { cookies } from 'next/headers';

const apiUrl =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    workspaceId?: string;
  };
};

function responseError(text: string): string {
  try {
    const parsed = JSON.parse(text) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text;
  }
}

export async function exchangeExtensionTicketAction(
  ticket: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedTicket = ticket.trim();
  if (!normalizedTicket) {
    return { ok: false, error: 'Extension login ticket is required.' };
  }

  try {
    const response = await fetch(`${apiUrl}/api/auth/extension/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticket: normalizedTicket }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        error: responseError((await response.text()).slice(0, 300)),
      };
    }

    const session = (await response.json()) as Session;
    const store = await cookies();
    const secure = process.env.NODE_ENV === 'production';
    const refreshAge = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86400;

    store.set('ls_access', session.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: session.expiresIn,
    });
    store.set('ls_refresh', session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: refreshAge,
    });

    if (session.user.workspaceId) {
      store.set('ls_workspace', session.user.workspaceId, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: refreshAge,
      });
    } else {
      store.delete('ls_workspace');
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
