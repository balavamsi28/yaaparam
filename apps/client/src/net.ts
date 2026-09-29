import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Action, RoomView } from '@nagarseth/engine';

const socket = io({ autoConnect: false });
const KEY = 'nagarseth.session';

type Ack<T> = ({ ok: true } & T) | { ok: false; error: string };
const call = <T = object>(event: string, data?: unknown) =>
  new Promise<Ack<T>>((resolve) =>
    socket.timeout(8000).emit(event, data, (err: Error | null, r: Ack<T>) =>
      resolve(err ? { ok: false, error: 'The server did not respond.' } : r)));

const saveSession = (s: { code: string; token: string } | null) => {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* private mode */ }
};
const loadSession = (): { code: string; token: string } | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
};

export function useNet() {
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  useEffect(() => {
    const onConnect = async () => {
      setConnected(true);
      const s = loadSession();
      if (!s) return;
      const r = await call('room:rejoin', s);
      if (!r.ok) { saveSession(null); setView(null); }
    };
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', setView);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', setView);
      socket.disconnect();
    };
  }, []);

  const run = useCallback(async <T extends object = object>(event: string, data?: unknown) => {
    const r = await call<T>(event, data);
    if (!r.ok) flash(r.error);
    return r;
  }, [flash]);

  const enter = async (event: string, data: unknown) => {
    const r = await run<{ code: string; token: string }>(event, data);
    if (r.ok) saveSession({ code: r.code, token: r.token });
    return r;
  };

  return {
    view, connected, toast,
    create: (name: string, maxPlayers?: number) => enter('room:create', { name, maxPlayers }),
    join: (code: string, name: string) => enter('room:join', { code, name }),
    start: () => run('room:start'),
    rematch: () => run('room:rematch'),
    remove: (playerId: string) => run('room:remove', { playerId }),
    addBot: () => run('room:addBot'),
    removeMember: (playerId: string) => run('room:removeMember', { playerId }),
    act: (a: Action) => run('game:action', a),
    leave: async () => { await run('room:leave'); saveSession(null); setView(null); },
  };
}
export type Net = ReturnType<typeof useNet>;
