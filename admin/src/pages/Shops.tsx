import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useRealtime } from '../lib/socket';

interface Shop {
  id: string;
  shopCode: string;
  name: string;
  ownerName: string | null;
  phone: string;
  isActive: boolean;
  isOnline: boolean;
  _count?: { requests: number; printers: number };
}

export function Shops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [form, setForm] = useState({ name: '', ownerName: '', phone: '', address: '' });
  const [created, setCreated] = useState<{ shopCode: string; generatedPassword?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ ...(search ? { search } : {}), ...(active ? { active } : {}) });
    const res = await api<{ shops: Shop[] }>(`/api/shops?${q}`);
    setShops(res.shops);
  }, [search, active]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  useRealtime('shop:updated', load);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ shop: Shop; generatedPassword?: string }>('/api/shops', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setCreated({ shopCode: res.shop.shopCode, generatedPassword: res.generatedPassword });
      setForm({ name: '', ownerName: '', phone: '', address: '' });
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s: Shop) => {
    const action = s.isActive ? 'deactivate' : 'activate';
    if (!confirm(`${action} ${s.name}?${s.isActive ? ' Owner will be locked out.' : ''}`)) return;
    await api(`/api/shops/${s.id}/${action}`, { method: 'POST' });
    void load();
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>Shops</h2>
      <div className="toolbar">
        <input placeholder="Search name / code / phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Deactivated</option>
        </select>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Shop</th><th>Code</th><th>Status</th><th>Online</th><th>Requests</th><th></th></tr></thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/shops/${s.id}`}><strong>{s.name}</strong></Link><div className="muted">{s.ownerName} • {s.phone}</div></td>
                <td>{s.shopCode}</td>
                <td><span className={`badge ${s.isActive ? 'green' : 'red'}`}>{s.isActive ? 'ACTIVE' : 'OFF'}</span></td>
                <td>{s.isOnline ? '● Online' : '○ Offline'}</td>
                <td>{s._count?.requests ?? '—'}</td>
                <td><button className={s.isActive ? 'btn danger' : 'btn secondary'} onClick={() => void toggle(s)}>{s.isActive ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ height: 12 }} />
      <form className="card" onSubmit={create}>
        <h3 style={{ margin: '0 0 8px' }}>Add shop + generate password</h3>
        <div className="grid3">
          <input placeholder="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Owner name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
          <input placeholder="Phone +91..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </div>
        <div style={{ height: 8 }} />
        <input placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div style={{ height: 10 }} />
        <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create shop'}</button>
        {created && (
          <p>Created <strong>{created.shopCode}</strong>{created.generatedPassword && <> — password: <code>{created.generatedPassword}</code> (copy now, shown once)</>}</p>
        )}
      </form>
    </div>
  );
}
