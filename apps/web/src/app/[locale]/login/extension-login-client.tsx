'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { extensionLoginAction } from '../auth-actions';

type ExtensionState = {
  installed: boolean;
  paired: boolean;
  deviceId?: string;
  version?: string;
};

type ExtensionMessage = {
  type?: string;
  requestId?: string;
  ok?: boolean;
  error?: string;
  ticket?: string;
  state?: ExtensionState;
  deviceId?: string;
};

export function ExtensionLoginClient({
  locale,
  initialError,
}: {
  locale: string;
  initialError?: string;
}) {
  const [state, setState] = useState<ExtensionState>({ installed: false, paired: false });
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ? decodeURIComponent(initialError) : '');
  const [pairingCode, setPairingCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const ticketRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let detected = false;
    const onMessage = (event: MessageEvent<ExtensionMessage>) => {
      if (event.source !== window || !event.data?.type) return;
      const message = event.data;
      if (message.type === 'LEADSIGNAL_EXTENSION_PONG') {
        detected = true;
        setChecking(false);
        setState({ installed: true, paired: Boolean(message.state?.paired), ...message.state });
        return;
      }
      if (message.type === 'LEADSIGNAL_EXTENSION_PAIR_RESULT') {
        setBusy(false);
        if (!message.ok) {
          setError(message.error ?? 'Không thể ghép nối extension.');
          return;
        }
        setError('');
        setState((current) => ({ ...current, installed: true, paired: true, deviceId: message.deviceId }));
        requestAuthentication();
        return;
      }
      if (message.type === 'LEADSIGNAL_EXTENSION_AUTH_RESULT') {
        setBusy(false);
        if (!message.ok || !message.ticket) {
          setError(message.error ?? 'Extension không thể xác thực thiết bị.');
          return;
        }
        if (ticketRef.current) ticketRef.current.value = message.ticket;
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: 'LEADSIGNAL_EXTENSION_PING', requestId: crypto.randomUUID() },
      window.location.origin,
    );
    const timeout = window.setTimeout(() => {
      if (!detected) {
        setChecking(false);
        setState({ installed: false, paired: false });
      }
    }, 1600);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  function requestAuthentication() {
    setBusy(true);
    setError('');
    window.postMessage(
      { type: 'LEADSIGNAL_EXTENSION_AUTH', requestId: crypto.randomUUID() },
      window.location.origin,
    );
  }

  function pairDevice() {
    if (!pairingCode.trim()) {
      setError('Nhập pairing code do owner/admin cấp.');
      return;
    }
    setBusy(true);
    setError('');
    window.postMessage(
      {
        type: 'LEADSIGNAL_EXTENSION_PAIR',
        requestId: crypto.randomUUID(),
        payload: {
          pairingCode: pairingCode.trim(),
          displayName: displayName.trim() || undefined,
          deviceLabel: `${navigator.platform || 'Browser'} LeadSignal Extension`,
        },
      },
      window.location.origin,
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Đăng nhập bằng LeadSignal Extension</h1>
        <p className="mt-2 text-slate-400">
          Không cần email hoặc mật khẩu. Extension ký một challenge bằng khóa riêng của thiết bị.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="panel space-y-4 p-6">
        {checking ? (
          <p className="text-sm text-slate-300">Đang kiểm tra extension…</p>
        ) : !state.installed ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-4">
              <p className="font-medium text-amber-200">Chưa phát hiện LeadSignal Extension</p>
              <p className="mt-2 text-sm text-amber-100/80">
                Cài extension, reload trang này, rồi ghép nối thiết bị bằng pairing code.
              </p>
            </div>
            <Link
              href={`/${locale}/extension`}
              className="block w-full rounded-lg bg-violet-600 px-4 py-2 text-center font-medium"
            >
              Xem hướng dẫn cài extension
            </Link>
          </div>
        ) : state.paired ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200">
              Extension đã được ghép nối{state.deviceId ? ` · ${state.deviceId.slice(0, 8)}` : ''}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={requestAuthentication}
              className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium disabled:opacity-50"
            >
              {busy ? 'Đang xác thực…' : 'Đăng nhập bằng extension'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              Tên hiển thị
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ví dụ: Minh"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Pairing code
              <input
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value)}
                placeholder="LS-XXXXXXXX-XXXXXX"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={pairDevice}
              className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium disabled:opacity-50"
            >
              {busy ? 'Đang ghép nối…' : 'Ghép nối và đăng nhập'}
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
