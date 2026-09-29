import { useState } from 'react';
import { MIN_PLAYERS } from '@nagarseth/engine';
import type { Net } from './net';
import { QrCode } from './QrCode';

export function Lobby({ net }: { net: Net }) {
  const v = net.view!;
  const isHost = v.you === v.hostId;
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/?room=${v.code}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const shareText = `Join my Nagar Seth game! Room code ${v.code}: ${link}`;
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Nagar Seth', text: shareText, url: link }); } catch { /* cancelled */ } }
    else window.open(`sms:?body=${encodeURIComponent(shareText)}`, '_self');
  };
  const online = v.members.filter((m) => m.connected || m.isBot).length;
  const full = v.members.length >= v.maxPlayers;

  return (
    <main className="home">
      <div className="card lobby">
        <p className="muted">Room code</p>
        <div className="room-code">{v.code}</div>
        <QrCode value={link} />
        <div className="row">
          <button className="btn small" onClick={copy}>{copied ? 'Link copied ✓' : 'Copy link'}</button>
          <a className="btn small" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <button className="btn small" onClick={share}>Share / SMS</button>
        </div>

        <h2>Players <span className="muted">{v.members.length}/{v.maxPlayers}</span></h2>
        <ul className="members">
          {v.members.map((m) => (
            <li key={m.id}>
              <span className="chip" style={{ background: m.color }} />
              <span className="grow">{m.name}{m.isBot && ' 🤖'}{m.id === v.you && ' (you)'}{m.id === v.hostId && ' 👑'}</span>
              {!m.connected && !m.isBot && <span className="muted">offline</span>}
              {isHost && m.id !== v.hostId && (m.isBot || !m.connected) && (
                <button className="btn tiny" onClick={() => (m.isBot ? net.removeMember(m.id) : net.remove(m.id))}>Remove</button>
              )}
            </li>
          ))}
        </ul>
        {isHost && <button className="btn" disabled={full} onClick={net.addBot}>🤖 Add bot</button>}

        {isHost ? (
          <button className="btn primary" disabled={online < MIN_PLAYERS} onClick={net.start}>
            {online < MIN_PLAYERS ? `Waiting for players (need ${MIN_PLAYERS})…` : 'Start game'}
          </button>
        ) : <p className="muted">Waiting for the host to start…</p>}
        <button className="btn ghost" onClick={net.leave}>Leave room</button>
      </div>
    </main>
  );
}
