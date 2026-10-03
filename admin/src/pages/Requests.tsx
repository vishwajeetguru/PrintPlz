import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useRealtime } from '../lib/socket';

interface Req {
  id: string; documentName: string; status: string; amount: number; customerName: string; createdAt: string;
}

export function Requests() {
  const [items, setItems] = useState<Req[]>([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [shopId, setShopId] = useState('');

  const load = useCallback(async () => {
    const q = new URLSearchParams({ ...(status !== 'ALL' ? { status } : {}), ...(search ? { search } : {}), ...(shopId ? { shopId } : {}) });
    const res = await api<{ requests: Req[] }>(`/api/requests?${q}`);
    setItems(res.requests);
  }, [status, search, shopId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  useRealtime('request:created', load);
  useRealtime('request:updated', load);

  const setStatusOf = async (id: string, s: string) => {
    await api(`/api/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
    void load();
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>Requests</h2>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {['ALL', 'NEW', 'ACCEPTED', 'PRINTING', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input placeholder="Search id / doc / customer" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input placeholder="Shop ID (optional)" value={shopId} onChange={(e) => setShopId(e.target.value)} />
      </div>
      <div className="card">
        <table>
          <thead><tr><th>ID</th><th>Document</th><th>Customer</th><th>Status</th><th>₹</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.documentName}</td>
                <td>{r.customerName}</td>
                <td><span className="badge blue">{r.status}</span></td>
                <td>₹{r.amount}</td>
                <td>
                  <select value={r.status} onChange={(e) => void setStatusOf(r.id, e.target.value)}>
                    {['NEW', 'ACCEPTED', 'PRINTING', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
