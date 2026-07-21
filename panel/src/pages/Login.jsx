import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Github, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthAPI, DISCORD_LOGIN_URL } from '../lib/api.js';
import { Spinner } from '../components/ui.jsx';

const REPO_URL = 'https://github.com/YvigUnderscore/MemeDrop';

// Emojis flottants du fond animé (positions/durées fixes pour un rendu stable).
const FLOATERS = [
  { e: '😂', l: '8%', d: '19s', s: '2.2rem', o: 0.16 },
  { e: '🔥', l: '22%', d: '23s', s: '1.6rem', o: 0.13 },
  { e: '💀', l: '35%', d: '17s', s: '2rem', o: 0.12 },
  { e: '🎬', l: '52%', d: '26s', s: '1.7rem', o: 0.14 },
  { e: '👏', l: '65%', d: '21s', s: '2.4rem', o: 0.11 },
  { e: '🤡', l: '78%', d: '18s', s: '1.8rem', o: 0.15 },
  { e: '😮', l: '90%', d: '24s', s: '2rem', o: 0.12 },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Public endpoint: should we offer Discord sign-in?
  useEffect(() => { AuthAPI.discordStatus().then((s) => setDiscordEnabled(!!s.enabled)).catch(() => {}); }, []);

  if (user) { navigate(user.role === 'member' ? '/profile' : '/', { replace: true }); return null; }

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const u = await login(username, password);
      navigate(u?.role === 'member' ? '/profile' : '/', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-bg min-h-screen grid place-items-center p-4 relative overflow-hidden">
      {/* Animated background: gradient blobs + floating emojis */}
      <div className="login-blob login-blob-1" aria-hidden />
      <div className="login-blob login-blob-2" aria-hidden />
      <div className="login-blob login-blob-3" aria-hidden />
      {FLOATERS.map((f, i) => (
        <span key={i} aria-hidden className="login-floater"
          style={{ left: f.l, animationDuration: f.d, fontSize: f.s, opacity: f.o, animationDelay: `${i * -3.1}s` }}>
          {f.e}
        </span>
      ))}

      <div className="w-full max-w-sm relative z-10 login-card-in">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="MemeDrop" className="w-24 h-24 rounded-3xl shadow-glow mb-4 login-logo" />
          <h1 className="text-4xl font-extrabold tracking-tight">MemeDrop</h1>
          <p className="text-muted text-sm mt-1.5 text-center">Drop memes on your friends' screens.<br />Sign in to join the fun.</p>
        </div>

        <div className="card p-6 space-y-4 backdrop-blur-md !bg-surface/80">
          {discordEnabled && (
            <>
              <a
                href={DISCORD_LOGIN_URL}
                className="btn-primary w-full justify-center !py-3 text-base"
                style={{ background: '#5865F2', boxShadow: '0 8px 28px -8px rgba(88,101,242,.7)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.607-.719 1.398-.984 2.02a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.997-2.02.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.533 7.55.943 10.65 1.233 13.71a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-3.577-.838-6.652-2.549-9.315a.061.061 0 0 0-.031-.028ZM8.02 11.848c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z" /></svg>
                Sign in with Discord
              </a>
              <p className="text-[11px] text-muted text-center -mt-1">Whitelisted members sign in here — no account needed.</p>
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="w-full flex items-center gap-3 text-xs text-muted hover:text-ink transition">
                <div className="h-px bg-border flex-1" />
                password sign-in <ChevronDown size={13} className={`transition-transform ${showPassword ? 'rotate-180' : ''}`} />
                <div className="h-px bg-border flex-1" />
              </button>
            </>
          )}

          {(!discordEnabled || showPassword) && (
            <form onSubmit={submit} className="space-y-4 login-form-in">
              <div>
                <label className="label">Username</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">{error}</div>}
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? <Spinner /> : <LogIn size={18} />} Sign in
              </button>
            </form>
          )}
          {!discordEnabled && error && !showPassword && null}
        </div>

        <p className="text-center text-xs text-muted mt-6 flex items-center justify-center gap-1.5">
          <a className="hover:text-ink transition flex items-center gap-1.5" href={REPO_URL} target="_blank" rel="noreferrer">
            <Github size={13} /> Free &amp; open-source — YvigUnderscore/MemeDrop
          </a>
        </p>
      </div>
    </div>
  );
}
