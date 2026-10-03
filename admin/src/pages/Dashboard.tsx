import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { EmptyState, PageHeader, StatCard } from '../components/ui';
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<Summary>('/api/analytics/summary?days=30');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtime('request:created', load);
  useRealtime('request:updated', load);

  if (!data) {
    return (
      <div>
        <PageHeader title="Overview" />
        <div className="card">
          <EmptyState title="Loading analytics…" />
        </div>
        <Modal
          open={error !== null}
          title="Something went wrong"
          confirmLabel="OK"
          onClose={() => setError(null)}
          onConfirm={() => setError(null)}
        >
          <p>{error}</p>
        </Modal>
      </div>
    );
  }

  const max = Math.max(1, ...data.requestsOverTime.map((d) => d.value));

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Last 30 days"
        action={
          <span className="live">
            <span className="dot" /> realtime
          </span>
        }
      />
      <div style={{ height: 12 }} />
      <div className="grid4">
        <StatCard value={`₹${data.revenue.toLocaleString('en-IN')}`} label="Revenue (30d)" />
        <StatCard value={String(data.totalRequests)} label="Requests (30d)" />
        <StatCard value={String(data.pagesPrinted)} label="Pages printed" />
        <StatCard value={String(data.shops)} label="Shops" />
      </div>
      <div style={{ height: 12 }} />
      <div className="grid3">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ margin: '0 0 12px' }}>Requests</h3>
          <div className="row" style={{ alignItems: 'end', height: 120 }}>
            {data.requestsOverTime.map((d) => (
              <div key={d.label} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  style={{
                    height: `${Math.max(4, (d.value / max) * 90)}px`,
                    background: 'var(--primary)',
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                />
                <div className="muted">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 12px' }}>Print type</h3>
          <p>B&W — {data.printType.bwPercent}%</p>
          <div className="bar">
            <div style={{ width: `${data.printType.bwPercent}%` }} />
          </div>
          <p style={{ marginTop: 12 }}>Color — {data.printType.colorPercent}%</p>
          <div className="bar">
            <div style={{ width: `${data.printType.colorPercent}%`, background: 'var(--warning)' }} />
          </div>
        </div>
      </div>
      <div style={{ height: 12 }} />
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Shops</h3>
          <Link to="/shops">Manage →</Link>
        </div>
        <p className="muted">
          Avg order ₹{data.averageOrder} • {data.completedRequests} completed
        </p>
      </div>

      <Modal
        open={error !== null}
        title="Something went wrong"
        confirmLabel="OK"
        onClose={() => setError(null)}
        onConfirm={() => setError(null)}
      >
        <p>{error}</p>
      </Modal>
    </div>
  );
}
