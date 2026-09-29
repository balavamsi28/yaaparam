import { useNet } from './net';
import { useAudio, type Audio } from './audio';
import { Home } from './Home';
import { Lobby } from './Lobby';
import { Game } from './Game';

function AudioControls({ audio }: { audio: Audio }) {
  return (
    <div className="audio-controls">
      <button className="btn tiny ghost" onClick={audio.toggleMusic} title="Music">{audio.music ? '🎵' : '🔇'}</button>
      <button className="btn tiny ghost" onClick={audio.toggleSfx} title="Sound effects">{audio.sfxOn ? '🔔' : '🔕'}</button>
      <input type="range" className="volume" min={0} max={1} step={0.05} value={audio.volume}
        onChange={(e) => audio.setVolume(Number(e.target.value))} aria-label="Volume" />
    </div>
  );
}

export function App() {
  const net = useNet();
  const audio = useAudio();
  const { view } = net;
  return (
    <>
      {!view ? <Home net={net} /> : view.phase === 'lobby' ? <Lobby net={net} /> : <Game net={net} audio={audio} />}
      <AudioControls audio={audio} />
      {!net.connected && <div className="banner">Connecting to server…</div>}
      {net.toast && <div className="toast" role="alert">{net.toast}</div>}
    </>
  );
}
