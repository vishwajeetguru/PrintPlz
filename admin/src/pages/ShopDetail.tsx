import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Dropdown } from '../components/Dropdown';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ActiveBadge, EmptyState, Field, PageHeader, SecretValue } from '../components/ui';
import { api } from '../lib/api';

interface Shop {
  id: string;
  shopCode: string;
  name: string;
  ownerName: string | null;
  phone: string;
  address: string | null;
  openTime: string | null;
  closeTime: string | null;
  workingDays: string | null;
  isActive: boolean;
  isOnline: boolean;
  priceBw: number;
  priceColor: number;
}

interface Row {
  id: string;
  documentName: string;
  status: string;
  amount: number;
}

const ONLINE_OPTIONS = [
  { value: 'online', label: '● Online' },
  { value: 'offline', label: '○ Offline' },
];

export function ShopDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { notify } = useToast();
  const [shop, setShop] = useState<Shop | null>(null);
  const [stats, setStats] = useState<{ requests: number; printers: number } | null>(null);
  const [requests, setRequests] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals (replaces alert/confirm)
  const [savedOpen, setSavedOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'password' | 'toggle' | 'delete' | null>(null);
  const [resetPw, setResetPw] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<{ shop: Shop; stats: { requests: number; printers: number } }>(
        `/api/shops/${id}`,
      );
      setShop(res.shop);
      setStats(res.stats);
      const r = await api<{ requests: Row[] }>(`/api/requests?shopId=${id}`);
      setRequests(r.requests.slice(0, 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shop');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <EmptyState title="Loading shop…" />;
  if (!shop) {
    return (
      <div>
        <PageHeader title="Shop not found" />
        <p className="muted">
          <Link to="/shops">← Back to shops</Link>
        </p>
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

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api<{ shop: Shop }>(`/api/shops/${shop.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: shop.name,
          ownerName: shop.ownerName,
          phone: shop.phone,
          address: shop.address,
          priceBw: shop.priceBw,
          priceColor: shop.priceColor,
          openTime: shop.openTime,
          closeTime: shop.closeTime,
          workingDays: shop.workingDays,
          isOnline: shop.isOnline,
        }),
      });
      setShop(updated.shop);
      setSavedOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    setSaving(true);
    try {
      const res = await api<{ generatedPassword?: string }>(
        `/api/shops/${shop.id}/reset-password`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setConfirmAction(null);
      setResetPw(res.generatedPassword ?? null);
      if (!res.generatedPassword) notify('Password updated');
    } catch (err) {
      setConfirmAction(null);
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      const code = shop.shopCode;
      await api(`/api/shops/${shop.id}`, { method: 'DELETE' });
      setConfirmAction(null);
      notify(`Shop ${code} deleted`);
      nav('/shops');
    } catch (err) {
      setConfirmAction(null);
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    setSaving(true);
    try {
      await api(`/api/shops/${shop.id}/${shop.isActive ? 'deactivate' : 'activate'}`, {
        method: 'POST',
      });
      setConfirmAction(null);
      notify(shop.isActive ? `${shop.name} deactivated` : `${shop.name} activated`);
      void load();
    } catch (err) {
      setConfirmAction(null);
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={shop.name}
        subtitle={`${shop.shopCode} • ${stats ? `${stats.requests} requests • ${stats.printers} printers` : ''}`}
        action={<Link to="/shops">← All shops</Link>}
      />
      <p>
        <ActiveBadge active={shop.isActive} />{' '}
        <span className="muted">{shop.isOnline ? '● Online' : '○ Offline'}</span>
      </p>

      <div className="card">
        <h3 style={{ margin: '0 0 12px' }}>Edit shop</h3>
        <div className="grid3">
          <Field label="Shop name">
            <input value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} />
          </Field>
          <Field label="Owner name">
            <input
              value={shop.ownerName ?? ''}
              onChange={(e) => setShop({ ...shop, ownerName: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })} />
          </Field>
          <Field label="Address">
            <input
              value={shop.address ?? ''}
              onChange={(e) => setShop({ ...shop, address: e.target.value })}
            />
          </Field>
          <Field label="B&W price (₹/page)">
            <input
              type="number"
              min={1}
              max={100}
              value={shop.priceBw}
              onChange={(e) => setShop({ ...shop, priceBw: Number(e.target.value) })}
            />
          </Field>
          <Field label="Color price (₹/page)">
            <input
              type="number"
              min={1}
              max={500}
              value={shop.priceColor}
              onChange={(e) => setShop({ ...shop, priceColor: Number(e.target.value) })}
            />
          </Field>
          <Field label="Availability">
            <Dropdown
              value={shop.isOnline ? 'online' : 'offline'}
              options={ONLINE_OPTIONS}
              onChange={(v) => setShop({ ...shop, isOnline: v === 'online' })}
              ariaLabel="Shop availability"
            />
          </Field>
          <Field label="Opens at" hint="HH:MM, 24-hour">
            <input
              value={shop.openTime ?? ''}
              onChange={(e) => setShop({ ...shop, openTime: e.target.value || null })}
              placeholder="09:00"
            />
          </Field>
          <Field label="Closes at" hint="HH:MM, 24-hour">
            <input
              value={shop.closeTime ?? ''}
              onChange={(e) => setShop({ ...shop, closeTime: e.target.value || null })}
              placeholder="21:00"
            />
          </Field>
          <Field label="Working days" hint="e.g. Mon,Tue,Wed,Thu,Fri,Sat">
            <input
              value={shop.workingDays ?? ''}
              onChange={(e) => setShop({ ...shop, workingDays: e.target.value || null })}
              placeholder="Mon,Tue,Wed,Thu,Fri,Sat"
            />
          </Field>
        </div>
        <div style={{ height: 14 }} />
        <div className="row">
          <button type="button" className="btn" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={saving}
            onClick={() => setConfirmAction('password')}
          >
            Generate password
          </button>
          <button
            type="button"
            className={shop.isActive ? 'btn danger' : 'btn secondary'}
            disabled={saving}
            onClick={() => setConfirmAction('toggle')}
          >
            {shop.isActive ? 'Deactivate shop' : 'Activate shop'}
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={saving}
            onClick={() => setConfirmAction('delete')}
          >
            Delete shop
          </button>
        </div>
        {!shop.isActive && (
          <p style={{ color: 'var(--error)', marginBottom: 0 }}>
            Deactivated: the owner is locked out of the mobile app with a “contact support” notice.
          </p>
        )}
      </div>

      <div style={{ height: 12 }} />
      <div className="card">
        <h3 style={{ margin: '0 0 8px' }}>Recent requests</h3>
        {requests.length === 0 ? (
          <EmptyState title="No requests yet" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.documentName}</td>
                    <td>
                      <span className="badge blue">{r.status}</span>
                    </td>
                    <td>₹{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Saved confirmation */}
      <Modal
        open={savedOpen}
        title="Shop updated"
        confirmLabel="OK"
        onClose={() => setSavedOpen(false)}
        onConfirm={() => setSavedOpen(false)}
      >
        <p>
          <strong>{shop.name}</strong> ({shop.shopCode}) was saved successfully.
        </p>
      </Modal>

      {/* Confirm: generate password / activate / deactivate / delete */}
      <Modal
        open={confirmAction !== null}
        title={
          confirmAction === 'password'
            ? 'Generate new password?'
            : confirmAction === 'delete'
              ? 'Delete shop permanently?'
              : shop.isActive
                ? 'Deactivate shop?'
                : 'Activate shop?'
        }
        confirmLabel={
          confirmAction === 'password'
            ? 'Generate'
            : confirmAction === 'delete'
              ? 'Delete forever'
              : shop.isActive
                ? 'Deactivate'
                : 'Activate'
        }
        cancelLabel="Cancel"
        tone={confirmAction === 'delete' || (confirmAction === 'toggle' && shop.isActive) ? 'danger' : 'default'}
        busy={saving}
        onClose={() => {
          if (!saving) setConfirmAction(null);
        }}
        onConfirm={() =>
          void (confirmAction === 'password' ? resetPassword() : confirmAction === 'delete' ? remove() : toggle())
        }
      >
        {confirmAction === 'password' ? (
          <p>
            A new login password will be generated for <strong>{shop.name}</strong>. The current
            password stops working immediately.
          </p>
        ) : confirmAction === 'delete' ? (
          <>
            <p>
              <strong>{shop.name}</strong> ({shop.shopCode}) and all of its data — requests,
              printers, notices, and the owner login — will be permanently deleted.
            </p>
            <p className="muted">This cannot be undone. Deactivate instead to keep the data.</p>
          </>
        ) : shop.isActive ? (
          <p>
            <strong>{shop.name}</strong> will be deactivated and the owner locked out of the mobile
            app.
          </p>
        ) : (
          <p>
            <strong>{shop.name}</strong> will be activated again.
          </p>
        )}
      </Modal>

      {/* New password result */}
      <Modal
        open={resetPw !== null}
        title="New password"
        confirmLabel="Done"
        onClose={() => setResetPw(null)}
        onConfirm={() => setResetPw(null)}
      >
        {resetPw && (
          <>
            <p className="muted">Share once — it will not be shown again.</p>
            <SecretValue value={resetPw} />
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
