// Client API du panel — cookies httpOnly pour la session.
async function request(method, path, body, { form = false } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    if (form) opts.body = body; // FormData
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(`/api${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b, o) => request('POST', p, b, o),
  put: (p, b, o) => request('PUT', p, b, o),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};

// --- Raccourcis typés ----------------------------------------------------
export const AuthAPI = {
  me: () => api.get('/auth/me'),
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  changePassword: (current, next) => api.post('/auth/change-password', { current, next }),
  users: () => api.get('/auth/users'),
  createUser: (b) => api.post('/auth/users', b),
  deleteUser: (id) => api.del(`/auth/users/${id}`),
  // --- Discord OAuth2 ---
  discordStatus: () => api.get('/auth/discord/status'),
  unlinkDiscord: () => api.post('/auth/discord/unlink'),
  saveStyle: (nameColor, nameGlow) => api.post('/auth/profile/style', { nameColor, nameGlow }),
};

// URLs de redirection OAuth (navigations top-level, pas des appels fetch).
export const DISCORD_LOGIN_URL = '/api/auth/discord/login';
export const DISCORD_LINK_URL = '/api/auth/discord/login?intent=link';

export const ChannelAPI = {
  list: () => api.get('/channels'),
  defaults: () => api.get('/channels/defaults'),
  get: (id) => api.get(`/channels/${id}`),
  create: (b) => api.post('/channels', b),
  update: (id, b) => api.patch(`/channels/${id}`, b),
  saveSettings: (id, b) => api.put(`/channels/${id}/settings`, b),
  saveDiscord: (id, b) => api.put(`/channels/${id}/discord`, b),
  remove: (id) => api.del(`/channels/${id}`),
  whitelist: (id) => api.get(`/channels/${id}/whitelist`),
  whitelistDiscordUsers: (id) => api.get(`/channels/${id}/whitelist/discord-users`),
  addWhitelist: (id, b) => api.post(`/channels/${id}/whitelist`, b),
  updateWhitelist: (id, wid, b) => api.patch(`/channels/${id}/whitelist/${wid}`, b),
  removeWhitelist: (id, wid) => api.del(`/channels/${id}/whitelist/${wid}`),
  groups: (id) => api.get(`/channels/${id}/groups`),
  createGroup: (id, b) => api.post(`/channels/${id}/groups`, b),
  updateGroup: (id, gid, b) => api.put(`/channels/${id}/groups/${gid}`, b),
  removeGroup: (id, gid) => api.del(`/channels/${id}/groups/${gid}`),
  devices: (id) => api.get(`/channels/${id}/devices`),
  pairCode: (id, b) => api.post(`/channels/${id}/devices/pair-code`, b),
  revokeDevice: (id, did) => api.del(`/channels/${id}/devices/${did}`),
  memes: (id, q = '') => api.get(`/channels/${id}/memes${q}`),
  memeReceipts: (id, mid) => api.get(`/channels/${id}/memes/${mid}/receipts`),
  leaderboard: (id, days = 30) => api.get(`/channels/${id}/leaderboard?days=${days}`),
  hall: (id, { days = 30, emoji = '' } = {}) => api.get(`/channels/${id}/hall?days=${days}${emoji ? `&emoji=${encodeURIComponent(emoji)}` : ''}`),
  memberProfile: (id, memberId) => api.get(`/channels/${id}/members/${encodeURIComponent(memberId)}/profile`),
  soundboard: (id) => api.get(`/channels/${id}/soundboard`),
  addSharedSound: (id, formData) => api.post(`/channels/${id}/soundboard`, formData, { form: true }),
  updateSharedSound: (id, sid, b) => api.patch(`/channels/${id}/soundboard/${sid}`, b),
  removeSharedSound: (id, sid) => api.del(`/channels/${id}/soundboard/${sid}`),
  removeMeme: (id, mid) => api.del(`/channels/${id}/memes/${mid}`),
  approveMeme: (id, mid) => api.post(`/channels/${id}/memes/${mid}/approve`),
  rejectMeme: (id, mid) => api.post(`/channels/${id}/memes/${mid}/reject`),
  resendMeme: (id, mid) => api.post(`/channels/${id}/memes/${mid}/resend`),
  purge: (id) => api.post(`/channels/${id}/purge`),
  sendMeme: (id, formData) => api.post(`/channels/${id}/meme`, formData, { form: true }),
};

// --- Hall of Memes (accessible staff + membres) --------------------------
export const HallAPI = {
  channels: () => api.get('/hall/channels'),
  weeks: (channelId) => api.get(`/hall/${channelId}/weeks`),
  top: (channelId, week = 'current') => api.get(`/hall/${channelId}/top?week=${encodeURIComponent(week)}`),
  comments: (memeId) => api.get(`/hall/memes/${encodeURIComponent(memeId)}/comments`),
  addComment: (memeId, text) => api.post(`/hall/memes/${encodeURIComponent(memeId)}/comments`, { text }),
  deleteComment: (id) => api.del(`/hall/comments/${id}`),
  react: (memeId, emoji) => api.post(`/hall/memes/${encodeURIComponent(memeId)}/react`, { emoji }),
};

export const SettingsAPI = {
  guidelines: () => api.get('/settings/guidelines'),
  saveGuidelines: (text) => api.put('/settings/guidelines', { text }),
  retention: () => api.get('/settings/retention'),
  saveRetention: (days) => api.put('/settings/retention', { days }),
  purgeAll: () => api.post('/settings/purge-all'),
  stats: () => api.get('/settings/stats'),
  audit: () => api.get('/settings/audit'),
  reports: () => api.get('/settings/reports'),
  resolveReport: (id) => api.post(`/settings/reports/${id}/resolve`),
  pending: () => api.get('/settings/pending'),
  security: () => api.get('/settings/security'),
  serverInfo: () => api.get('/settings/server-info'),
  logoutAll: () => api.post('/settings/security/logout-all'),
  revokeDevices: () => api.post('/settings/security/revoke-devices'),
  invalidatePairing: () => api.post('/settings/security/invalidate-pairing'),
};

// --- WebSocket temps réel du panel (#4) ---------------------------------
// Ouvre une connexion et appelle onEvent(msg) à chaque événement.
// Renvoie une fonction de fermeture. Reconnexion automatique.
export function connectPanelWS(onEvent) {
  let ws = null;
  let closed = false;
  let retry = null;
  const open = () => {
    if (closed) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws-panel`);
    ws.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch { /* ignore */ } };
    ws.onclose = () => { if (!closed) retry = setTimeout(open, 3000); };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  };
  open();
  return () => { closed = true; clearTimeout(retry); try { ws && ws.close(); } catch { /* ignore */ } };
}
