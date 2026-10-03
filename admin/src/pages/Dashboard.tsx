import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useRealtime } from '../lib/socket';

interface Summary {
  revenue: number;
  totalRequests: number;
  completedRequests: number;
  pagesPrinted: number;
  averageOrder: number;
  shops: number;
  requestsOverTime: Array<{ label: string; value: number }>;
  printType: { bwPercent: number; colorPercent: number };
}

export function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const load = useCallback(async () => {
    const res = await api<Summary>('/api/analytics/summary?days=30');
    setData(res);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useRealtime('request:created', load);
  useRealtime('request:updated', load);

  if (!data) return <p>Loading…</p>;
  const max = Math.max(1, ...data.requestsOverTime.map((d) => d.value));
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Overview</h2>
        <span className="live"><span className="dot" /> realtime</span>
      </div>
      <div style={{ height: 14 }} />
      <div className="grid4">
        <div className="card"><div className="stat-value">₹{data.revenue.toLocaleString('en-IN')}</div><div className="stat-label">Revenue (30d)</div></div>
        <div className="card"><div className="stat-value">{data.totalRequests}</div><div className="stat-label">Requests (30d)</div></div>
        <div className="card"><div className="stat-value">{data.pagesPrinted}</div><div className="stat-label">Pages printed</div></div>
        <div className="card"><div className="stat-value">{data.shops}</div><div className="stat-label">Shops</div></div>
      </div>
      <div style={{ height: 12 }} />
      <div className="grid3">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ margin: '0 0 12px' }}>Requests</h3>
          <div className="row" style={{ alignItems: 'end', height: 120 }}>
            {data.requestsOverTime.map((d) => (
              <div key={d.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: `${Math.max(4, (d.value / max) * 90)}px`, background: 'var(--primary)', borderRadius: 6, marginBottom: 6 }} />
                <div className="muted">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 12px' }}>Print type</h3>
          <p>B&W — {data.printType.bwPercent}%</p>
          <div className="bar"><div style={{ width: `${data.printType.bwPercent}%` }} /></div>
          <p style={{ marginTop: 12 }}>Color — {data.printType.colorPercent}%</p>
          <div className="bar"><div style={{ width: `${data.printType.colorPercent}%`, background: 'var(--warning)' }} /></div>
        </div>
      </div>
      <div style={{ height: 12 }} />
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Shops</h3>
          <Link to="/shops">Manage →</Link>
        </div>
        <p className="muted">Avg order ₹{data.averageOrder} • {data.completedRequests} completed</p>
      </div>
    </div>
  );
}
