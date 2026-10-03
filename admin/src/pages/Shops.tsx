import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown } from '../components/Dropdown';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ActiveBadge, EmptyState, Field, PageHeader, SecretValue } from '../components/ui';
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

const ACTIVE_OPTIONS = [
  { value: '', label: 'All shops' },
  { value: 'true', label: 'Active only' },
  { value: 'false', label: 'Deactivated only' },
];

const EMPTY_FORM = { name: '', ownerName: '', phone: '', address: '' };

export function Shops() {
  const { notify } = useToast();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  // Modals (replaces alert/confirm)
  const [addOpen, setAddOpen] = useState(false);
  const [created, setCreated] = useState<{ shopCode: string; generatedPassword?: string } | null>(null);
  const [confirmShop, setConfirmShop] = useState<Shop | null>(null);
  const [deleteShop, setDeleteShop] = useState<Shop | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ ...(search ? { search } : {}), ...(active ? { active } : {}) });
      const res = await api<{ shops: Shop[] }>(`/api/shops?${q}`);
      setShops(res.shops);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shops');
    } finally {
      setLoading(false);
    }
  }, [search, active]);

  useEffect(() => {
    setLoading(true);
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
      setForm(EMPTY_FORM);
      setAddOpen(false);
      setCreated({ shopCode: res.shop.shopCode, generatedPassword: res.generatedPassword });
      notify(`Shop ${res.shop.shopCode} created`);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteShop) return;
    setBusy(true);
    try {
      await api(`/api/shops/${deleteShop.id}`, { method: 'DELETE' });
      notify(`Shop ${deleteShop.shopCode} deleted`);
      setDeleteShop(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };
  const toggle = async () => {
    if (!confirmShop) return;
    setBusy(true);
    try {
      const action = confirmShop.isActive ? 'deactivate' : 'activate';
      await api(`/api/shops/${confirmShop.id}/${action}`, { method: 'POST' });
      notify(confirmShop.isActive ? `${confirmShop.name} deactivated` : `${confirmShop.name} activated`);
      setConfirmShop(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Shops"
        subtitle={`${shops.length} shop${shops.length === 1 ? '' : 's'} • click a name to view & edit details`}
        action={
          <button type="button" className="btn" onClick={() => setAddOpen(true)}>
            + Add shop
          </button>
        }
      />

      <div className="toolbar">
        <input
          placeholder="Search name / code / phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search shops"
        />
        <Dropdown
          value={active}
          options={ACTIVE_OPTIONS}
          onChange={setActive}
          placeholder="All shops"
          ariaLabel="Filter by status"
        />
      </div>

      <div className="card">
        {loading ? (
          <EmptyState title="Loading shops…" />
        ) : shops.length === 0 ? (
          <EmptyState title="No shops found" hint="Try a different search or add a new shop." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Online</th>
                  <th>Requests</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/shops/${s.id}`} className="cell-main">
                        {s.name}
                      </Link>
                      <div className="cell-sub">
                        {s.ownerName} • {s.phone}
                      </div>
                    </td>
                    <td>{s.shopCode}</td>
                    <td>
                      <ActiveBadge active={s.isActive} />
                    </td>
                    <td>{s.isOnline ? '● Online' : '○ Offline'}</td>
                    <td>{s._count?.requests ?? '—'}</td>
                    <td>
                      <div className="row">
                        <Link to={`/shops/${s.id}`} className="btn secondary btn-sm">
                          Edit
                        </Link>
                        <button
                          type="button"
                          className={s.isActive ? 'btn danger btn-sm' : 'btn secondary btn-sm'}
                          onClick={() => setConfirmShop(s)}
                        >
                          {s.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn danger btn-sm"
                          onClick={() => setDeleteShop(s)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add shop modal */}
      <Modal
        open={addOpen}
        title="Add shop + generate password"
        confirmLabel={busy ? 'Creating…' : 'Create shop'}
        cancelLabel="Cancel"
        busy={busy}
        onClose={() => {
          if (!busy) setAddOpen(false);
        }}
        onConfirm={() => {
          // Submit the inner form programmatically.
          (document.getElementById('add-shop-form') as HTMLFormElement | null)?.requestSubmit();
        }}
      >
        <form id="add-shop-form" onSubmit={create}>
          <div className="grid3">
            <Field label="Shop name">
              <input
                placeholder="e.g. Rajesh Xerox"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Owner name">
              <input
                placeholder="e.g. Rajesh Kumar"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                required
              />
            </Field>
            <Field label="Phone">
              <input
                placeholder="+91..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </Field>
          </div>
          <div style={{ height: 10 }} />
          <Field label="Address" hint="Optional">
            <input
              placeholder="Shop address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </form>
      </Modal>

      {/* Created result modal (password shown once) */}
      <Modal
        open={created !== null}
        title="Shop created"
        confirmLabel="Done"
        onClose={() => setCreated(null)}
        onConfirm={() => setCreated(null)}
      >
        {created && (
          <>
            <p>
              Shop <strong>{created.shopCode}</strong> is live.
            </p>
            {created.generatedPassword ? (
              <>
                <p className="muted">Share this password once — it will not be shown again.</p>
                <SecretValue value={created.generatedPassword} />
              </>
            ) : (
              <p className="muted">A custom password was set for this shop.</p>
            )}
          </>
        )}
      </Modal>

      {/* Activate / deactivate confirm modal */}
      <Modal
        open={confirmShop !== null}
        title={confirmShop?.isActive ? 'Deactivate shop?' : 'Activate shop?'}
        confirmLabel={confirmShop?.isActive ? 'Deactivate' : 'Activate'}
        cancelLabel="Cancel"
        tone={confirmShop?.isActive ? 'danger' : 'default'}
        busy={busy}
        onClose={() => {
          if (!busy) setConfirmShop(null);
        }}
        onConfirm={() => void toggle()}
      >
        {confirmShop && (
          <p>
            {confirmShop.isActive ? (
              <>
                <strong>{confirmShop.name}</strong> will be deactivated. The owner is locked out of
                the mobile app with a “contact support” notice.
              </>
            ) : (
              <>
                <strong>{confirmShop.name}</strong> will be activated again.
              </>
            )}
          </p>
        )}
      </Modal>

      {/* Delete confirm modal (permanent) */}
      <Modal
        open={deleteShop !== null}
        title="Delete shop permanently?"
        confirmLabel="Delete forever"
        cancelLabel="Cancel"
        tone="danger"
        busy={busy}
        onClose={() => {
          if (!busy) setDeleteShop(null);
        }}
        onConfirm={() => void remove()}
      >
        {deleteShop && (
          <>
            <p>
              <strong>{deleteShop.name}</strong> ({deleteShop.shopCode}) and all of its data —
              requests, printers, notices, and the owner login — will be permanently deleted.
            </p>
            <p className="muted">This cannot be undone. Deactivate instead to keep the data.</p>
          </>
        )}
      </Modal>

      {/* Error modal */}
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
