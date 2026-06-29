'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  createExtensionPairingCodeAction,
  extensionLoginAction,
  getExtensionSessionStateAction,
} from '../auth-actions';

type ExtensionState = {
  installed: boolean;
  paired: boolean;
  deviceId?: string;
  workspaceId?: string;
  version?: string;
};

type SessionState = {
  authenticated: boolean;
  workspaceId: string | null;
};

type ExtensionMessage = {
  type?: string;
  requestId?: string;
  ok?: boolean;
  error?: string;
  ticket?: string;
  state?: ExtensionState;
  deviceId?: string;
  workspaceId?: string;
};

export function ExtensionLoginClient({
  locale,
  initialError,
}: {
  locale: string;
  initialError?: string;
}) {
  const [state, setState] = useState<ExtensionState>({ installed: false, paired: false });
  const [session, setSession] = useState<SessionState | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ? decodeURIComponent(initialError) : '');
  const ticketRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const autoStartedRef = useRef(false);

  function requestAuthentication() {
    setBusy(true);
    setError('');
    window.postMessage(
      { type: 'LEADSIGNAL_EXTENSION_AUTH', requestId: crypto.randomUUID() },
      window.location.origin,
    );
  }

  async function pairFromCurrentSession() {
    setBusy(true);
    setError('');
    const result = await createExtensionPairingCodeAction();
    if (!result.ok || !result.pairingCode) {
      setBusy(false);
      autoStartedRef.current = false;
      setError(result.error ?? 'Không thể ghép nối extension.');
      return;
    }

    window.postMessage(
      {
        type: 'LEADSIGNAL_EXTENSION_PAIR',
        requestId: crypto.randomUUID(),
        payload: {
          pairingCode: result.pairingCode,
          deviceLabel: `${navigator.platform || 'Browser'} LeadSignal Extension`,
        },
      },
      window.location.origin,
    );
  }

  function startAutomaticFlow(current: ExtensionState, currentSession: SessionState) {
    if (autoStartedRef.current) return;
    if (!currentSession.authenticated || !currentSession.workspaceId) return;
    autoStartedRef.current = true;
    if (current.paired) requestAuthentication();
    else void pairFromCurrentSession();
  }

  useEffect(() => {
    let detected = false;
    let currentSession: SessionState | null = null;

    const onMessage = (event: MessageEvent<ExtensionMessage>) => {
      if (event.source !== window || event.origin !== window.location.origin || !event.data?.type) return;
      const message = event.data;

      if (message.type === 'LEADSIGNAL_EXTENSION_PONG') {
        detected = true;
        const nextState = {
          installed: true,
          paired: Boolean(message.state?.paired),
          ...message.state,
        } as ExtensionState;
        setState(nextState);
        setChecking(false);
        if (currentSession) startAutomaticFlow(nextState, currentSession);
        return;
      }

      if (message.type === 'LEADSIGNAL_EXTENSION_PAIR_RESULT') {
        if (!message.ok) {
          autoStartedRef.current = false;
          setBusy(false);
          setError(message.error ?? 'Không thể ghép nối extension.');
          return;
        }
        setState((current) => ({
          ...current,
          installed: true,
          paired: true,
          deviceId: message.deviceId,
          workspaceId: message.workspaceId,
        }));
        requestAuthentication();
        return;
      }

      if (message.type === 'LEADSIGNAL_EXTENSION_AUTH_RESULT') {
        setBusy(false);
        if (!message.ok || !message.ticket) {
          autoStartedRef.current = false;
          setError(message.error ?? 'Extension không thể xác thực thiết bị.');
          return;
        }
        if (ticketRef.current) ticketRef.current.value = message.ticket;
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener('message', onMessage);

    void getExtensionSessionStateAction().then((value) => {
      currentSession = value;
      setSession(value);
      window.postMessage(
        { type: 'LEADSIGNAL_EXTENSION_PING', requestId: crypto.randomUUID() },
        window.location.origin,
      );
    });

    const timeout = window.setTimeout(() => {
      if (!detected) {
        setChecking(false);
        setState({ installed: false, paired: false });
      }
    }, 2500);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  function retry() {
    if (!session?.authenticated || !session.workspaceId) return;
    autoStartedRef.current = false;
    startAutomaticFlow(state, session);
  }

  const needsAccount = session !== null && !session.authenticated;
  const needsWorkspace = session?.authenticated && !session.workspaceId;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Kết nối LeadSignal Extension</h1>
        <p className="mt-2 text-slate-400">
          Tạo hoặc đăng nhập tài khoản LeadSignal trước. Sau đó hệ thống sẽ tự ghép nối extension bằng phiên đăng nhập hiện tại.
        </p>
      </div>

      {error && !needsAccount && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="panel space-y-4 p-6">
        {checking || session === null ? (
          <p className="text-sm text-slate-300">Đang kiểm tra tài khoản và extension…</p>
        ) : needsAccount ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-4">
              <p className="font-medium text-amber-200">Bạn chưa có phiên đăng nhập LeadSignal</p>
              <p className="mt-2 text-sm text-amber-100/80">
                Extension không tạo tài khoản độc lập. Hãy tạo tài khoản trước, hệ thống sẽ quay lại đây và tự động ghép nối.
              </p>
            </div>
            <Link
              href={`/${locale}/register`}
              className="block w-full rounded-lg bg-violet-600 px-4 py-2 text-center font-medium hover:bg-violet-500"
            >
              Tạo tài khoản
            </Link>
          </div>
        ) : needsWorkspace ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-100">
              Tài khoản đã đăng nhập nhưng chưa có workspace. Hãy hoàn tất đăng ký workspace hoặc tham gia bằng lời mời trước khi ghép nối extension.
            </div>
          </div>
        ) : !state.installed ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-4">
              <p className="font-medium text-amber-200">Chưa phát hiện LeadSignal Extension</p>
              <p className="mt-2 text-sm text-amber-100/80">
                Cài hoặc reload extension, sau đó reload lại trang này.
              </p>
            </div>
            <Link
              href={`/${locale}/extension`}
              className="block w-full rounded-lg bg-violet-600 px-4 py-2 text-center font-medium"
            >
              Mở hướng dẫn extension
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200">
              {state.paired
                ? 'Extension đã ghép nối. Đang xác thực thiết bị…'
                : 'Đã phát hiện extension. Đang tự động ghép nối với tài khoản hiện tại…'}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={retry}
              className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium disabled:opacity-50"
            >
              {busy ? 'Đang xử lý…' : 'Thử lại'}
            </button>
          </div>
        )}
      </div>

      <form ref={formRef} action={extensionLoginAction} className="hidden">
        <input type="hidden" name="locale" value={locale} />
        <input ref={ticketRef} type="hidden" name="ticket" />
      </form>
    </div>
  );
}
