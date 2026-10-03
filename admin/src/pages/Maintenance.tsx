import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function Maintenance() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<{ maintenanceMode: boolean; message: string }>('/api/system/status').then((s) => {
      setEnabled(s.maintenanceMode);
      setMessage(s.message);
    }).catch(() => {});
  }, []);

  const save = async () => {
    const res = await api<{ maintenanceMode: boolean }>('/api/system/maintenance', {
      method: 'PUT',
      body: JSON.stringify({ enabled, message }),
    });
    alert(res.maintenanceMode ? 'Maintenance ON — mobile apps show the notice.' : 'Maintenance OFF.');
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>Maintenance mode</h2>
      <p className="muted">When ON, the vendor mobile app blocks interaction and shows your message (realtime).</p>
      <div className="card">
        <label className="row"><input type="checkbox" style={{ width: 20 }} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable maintenance</label>
        <div style={{ height: 10 }} />
        <label>Message<textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        <div style={{ height: 12 }} />
        <button className="btn" onClick={() => void save()}>Save</button>
      </div>
    </div>
  );
}
