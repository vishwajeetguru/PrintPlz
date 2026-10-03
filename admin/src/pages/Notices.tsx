import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function Notices() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [shopId, setShopId] = useState('');
  const [broadcast, setBroadcast] = useState(true);
  const [recent, setRecent] = useState<Array<{ id: string; title: string; message: string; createdAt: string }>>([]);

  const load = async () => {
    const res = await api<{ notifications: Array<{ id: string; title: string; message: string; createdAt: string }> }>('/api/notifications');
    setRecent(res.notifications.slice(0, 20));
  };

  useEffect(() => {
    void load();
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/api/notifications/notices', {
      method: 'POST',
      body: JSON.stringify({ title, message, broadcast, ...(broadcast ? {} : { shopId }) }),
    });
    setTitle('');
    setMessage('');
    alert(broadcast ? 'Broadcast sent to all shops (realtime + notifications).' : `Notice sent to ${shopId}.`);
    void load();
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>Notices</h2>
      <p className="muted">Superadmin → shop(s). Delivered realtime via socket + stored as notifications in the mobile app.</p>
      <form className="card" onSubmit={send}>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <div style={{ height: 8 }} />
        <label>Message<textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} required /></label>
        <div style={{ height: 8 }} />
        <label className="row"><input type="checkbox" style={{ width: 18 }} checked={broadcast} onChange={(e) => setBroadcast(e.target.checked)} /> Send to ALL shops</label>
        {!broadcast && (
          <div style={{ height: 8 }}>
            <input placeholder="Shop ID (e.g. from Shops page)" value={shopId} onChange={(e) => setShopId(e.target.value)} required={!broadcast} />
          </div>
        )}
        <div style={{ height: 12 }} />
        <button className="btn">Send notice</button>
      </form>
      <div style={{ height: 12 }} />
      <div className="card">
        <h3 style={{ margin: '0 0 8px' }}>Recent</h3>
        {recent.map((n) => (
          <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f2f5' }}>
            <strong>{n.title}</strong>
            <div className="muted">{n.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
