'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, getWorkspaceId } from '@/lib/api';

const apiUrl =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    displayName: string;
    workspaceId?: string;
  };
};

async function saveSession(session: Session) {
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
}

function responseError(text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text;
  }
}

async function authenticate(
  endpoint: string,
  payload: Record<string, string>,
  locale: string,
  errorPage = 'login',
) {
  const response = await fetch(`${apiUrl}/api/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = encodeURIComponent(
      responseError((await response.text()).slice(0, 300)),
    );
    redirect(`/${locale}/${errorPage}?error=${message}`);
  }

  await saveSession((await response.json()) as Session);
  redirect(`/${locale}/login`);
}

export async function extensionLoginAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  return authenticate(
    'extension/exchange',
    { ticket: String(formData.get('ticket') ?? '') },
    locale,
  );
}

export async function loginAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  return authenticate(
    'login',
    {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    },
    locale,
  );
}

export async function registerAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  return authenticate(
    'register',
    {
      email: String(formData.get('email') ?? ''),
      displayName: String(formData.get('displayName') ?? ''),
      password: String(formData.get('password') ?? ''),
    },
    locale,
    'register',
  );
}

export async function logoutAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const store = await cookies();
  const access = store.get('ls_access')?.value;

  if (access) {
    await fetch(`${apiUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${access}` },
      cache: 'no-store',
    }).catch(() => undefined);
  }

  store.delete('ls_access');
  store.delete('ls_refresh');
  store.delete('ls_workspace');
  redirect(`/${locale}/login`);
}

export async function acceptInvitationAction(formData: FormData) {
  const locale = String(formData.get('locale') ?? 'vi');
  const token = String(formData.get('token') ?? '');
  const result = await api<{ workspaceId: string }>('/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

  (await cookies()).set('ls_workspace', result.workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86400,
  });
  redirect(`/${locale}`);
}

export async function getExtensionSessionStateAction() {
  const store = await cookies();
  return {
    authenticated: Boolean(store.get('ls_access')?.value),
    workspaceId: store.get('ls_workspace')?.value ?? null,
  };
}

export async function createExtensionPairingCodeAction() {
  try {
    const store = await cookies();
    if (!store.get('ls_access')?.value) {
      return {
        ok: false,
        code: 'AUTH_REQUIRED',
        error: 'You must create an account or sign in before pairing the extension.',
      };
    }

    const workspaceId = await getWorkspaceId();
    if (!workspaceId) {
      return {
        ok: false,
        code: 'WORKSPACE_REQUIRED',
        error: 'Your account does not have an active workspace yet.',
      };
    }

    const result = await api<{ pairingCode: string }>(
      `/workspaces/${workspaceId}/extension-devices/pairing-codes`,
      {
        method: 'POST',
        body: JSON.stringify({
          displayName: 'Browser extension',
          role: 'MEMBER',
          expiresInMinutes: 5,
        }),
      },
    );
    return { ok: true, pairingCode: result.pairingCode };
  } catch (error) {
    return {
      ok: false,
      code: 'PAIRING_FAILED',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
