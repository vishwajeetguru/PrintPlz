import { useCallback, useEffect, useState } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { EmptyState, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useRealtime } from '../lib/socket';

interface Req {
  id: string;
  documentName: string;
  status: string;
  amount: number;
  customerName: string;
  createdAt: string;
}

const STATUSES = ['NEW', 'ACCEPTED', 'PRINTING', 'COMPLETED', 'CANCELLED'];

const FILTER_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  ...STATUSES.map((s) => ({ value: s, label: s })),
];

const ROW_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }));

export function Requests() {
  const { notify } = useToast();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [shopId, setShopId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Confirm modal when moving a request to CANCELLED (destructive).
  const [pending, setPending] = useState<{ id: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        ...(status !== 'ALL' ? { status } : {}),
        ...(search ? { search } : {}),
        ...(shopId ? { shopId } : {}),
      });
      const res = await api<{ requests: Req[] }>(`/api/requests?${q}`);
      setItems(res.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [status, search, shopId]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  useRealtime('request:created', load);
  useRealtime('request:updated', load);

  const applyStatus = async (id: string, s: string) => {
    setBusy(true);
    try {
      await api(`/api/requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: s }),
      });
      notify(`Request ${id} → ${s}`);
      setPending(null);
      void load();
    } catch (err) {
      setPending(null);
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (id: string, current: string, next: string) => {
    if (next === current) return;
    if (next === 'CANCELLED') {
      setPending({ id, status: next });
      return;
    }
    void applyStatus(id, next);
  };

  return (
    <div>
      <PageHeader title="Requests" subtitle="Change status per request — shops see it live" />

      <div className="toolbar">
        <Dropdown
          value={status}
          options={FILTER_OPTIONS}
          onChange={setStatus}
          placeholder="All statuses"
          ariaLabel="Filter by status"
        />
        <input
          placeholder="Search id / doc / customer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search requests"
        />
        <input
          placeholder="Shop ID (optional)"
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          aria-label="Filter by shop id"
        />
      </div>

      <div className="card">
        {loading ? (
          <EmptyState title="Loading requests…" />
        ) : items.length === 0 ? (
          <EmptyState title="No requests" hint="Try a different filter." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Document</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>₹</th>
                  <th aria-label="Change status">Set status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.documentName}</td>
                    <td>{r.customerName}</td>
                    <td>
                      <span className="badge blue">{r.status}</span>
                    </td>
                    <td>₹{r.amount}</td>
                    <td style={{ minWidth: 170 }}>
                      <Dropdown
                        value={r.status}
                        options={ROW_OPTIONS}
                        onChange={(v) => onPick(r.id, r.status, v)}
                        ariaLabel={`Set status for ${r.id}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Destructive confirm */}
      <Modal
        open={pending !== null}
        title="Cancel request?"
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        tone="danger"
        busy={busy}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={() => {
          if (pending) void applyStatus(pending.id, pending.status);
        }}
      >
        <p>
          Request <strong>{pending?.id}</strong> will be marked <strong>CANCELLED</strong>. The shop
          and customer tracking see this immediately.
        </p>
      </Modal>

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
