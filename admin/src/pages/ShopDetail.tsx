import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface Shop {
  id: string; shopCode: string; name: string; ownerName: string | null; phone: string;
  address: string | null; isActive: boolean; isOnline: boolean; priceBw: number; priceColor: number;
}

export function ShopDetail() {
  const { id } = useParams();
  const [shop, setShop] = useState<Shop | null>(null);
  const [stats, setStats] = useState<{ requests: number; printers: number } | null>(null);
  const [requests, setRequests] = useState<Array<{ id: string; documentName: string; status: string; amount: number }>>([]);
  const [resetPw, setResetPw] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const res = await api<{ shop: Shop; stats: { requests: number; printers: number } }>(`/api/shops/${id}`);
    setShop(res.shop);
    setStats(res.stats);
    const r = await api<{ requests: Array<{ id: string; documentName: string; status: string; amount: number }> }>(`/api/requests?shopId=${id}`);
    setRequests(r.requests.slice(0, 20));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!shop) return <p>Loading…</p>;

  const save = async () => {
    const updated = await api<{ shop: Shop }>(`/api/shops/${shop.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: shop.name, ownerName: shop.ownerName, address: shop.address, priceBw: shop.priceBw, priceColor: shop.priceColor }),
    });
    setShop(updated.shop);
    alert('Saved');
  };

  const resetPassword = async () => {
    if (!confirm(`Generate a new password for ${shop.name}?`)) return;
    const res = await api<{ generatedPassword?: string }>(`/api/shops/${shop.id}/reset-password`, { method: 'POST', body: JSON.stringify({}) });
    setResetPw(res.generatedPassword ?? '(custom password set)');
  };

  const toggle = async () => {
    await api(`/api/shops/${shop.id}/${shop.isActive ? 'deactivate' : 'activate'}`, { method: 'POST' });
    void load();
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>{shop.name} <span className="muted">({shop.shopCode})</span></h2>
      <p><span className={`badge ${shop.isActive ? 'green' : 'red'}`}>{shop.isActive ? 'ACTIVE' : 'DEACTIVATED'}</span> {stats && <span className="muted">{stats.requests} requests • {stats.printers} printers</span>}</p>
      <div className="card">
        <div className="grid3">
          <label>Shop name<input value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} /></label>
          <label>Owner<input value={shop.ownerName ?? ''} onChange={(e) => setShop({ ...shop, ownerName: e.target.value })} /></label>
          <label>Address<input value={shop.address ?? ''} onChange={(e) => setShop({ ...shop, address: e.target.value })} /></label>
          <label>B&W ₹/page<input type="number" value={shop.priceBw} onChange={(e) => setShop({ ...shop, priceBw: Number(e.target.value) })} /></label>
          <label>Color ₹/page<input type="number" value={shop.priceColor} onChange={(e) => setShop({ ...shop, priceColor: Number(e.target.value) })} /></label>
        </div>
        <div style={{ height: 12 }} />
        <div className="row">
          <button className="btn" onClick={() => void save()}>Save</button>
          <button className="btn secondary" onClick={() => void resetPassword()}>Generate password</button>
          <button className={shop.isActive ? 'btn danger' : 'btn secondary'} onClick={() => void toggle()}>{shop.isActive ? 'Deactivate shop' : 'Activate shop'}</button>
        </div>
        {resetPw && <p>New password: <code>{resetPw}</code> — share once, then discard.</p>}
        {!shop.isActive && <p style={{ color: 'var(--error)' }}>Deactivated: the owner is locked out of the mobile app with a “contact support” notice.</p>}
      </div>
      <div style={{ height: 12 }} />
      <div className="card">
        <h3 style={{ margin: '0 0 8px' }}>Recent requests</h3>
        <table>
          <thead><tr><th>ID</th><th>Document</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}><td>{r.id}</td><td>{r.documentName}</td><td><span className="badge blue">{r.status}</span></td><td>₹{r.amount}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
