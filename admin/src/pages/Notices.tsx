import { useEffect, useState } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { EmptyState, Field, PageHeader } from '../components/ui';
import { api } from '../lib/api';

interface ShopOpt {
  id: string;
  name: string;
  shopCode: string;
}

export function Notices() {
  const { notify } = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [shops, setShops] = useState<ShopOpt[]>([]);
  const [shopId, setShopId] = useState('');
  const [broadcast, setBroadcast] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<
    Array<{ id: string; title: string; message: string; createdAt: string }>
  >([]);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api<{
        notifications: Array<{ id: string; title: string; message: string; createdAt: string }>;
      }>('/api/notifications');
      setRecent(res.notifications.slice(0, 20));
    } catch {
      // Recent list is best-effort; the form still works.
    }
  };

  useEffect(() => {
    void load();
    api<{ shops: ShopOpt[] }>('/api/shops')
      .then((r) => setShops(r.shops))
      .catch(() => {});
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/notifications/notices', {
        method: 'POST',
        body: JSON.stringify({ title, message, broadcast, ...(broadcast ? {} : { shopId }) }),
      });
      const msg = broadcast
        ? 'Broadcast sent to all shops (realtime + notifications).'
        : `Notice sent to the selected shop.`;
      setTitle('');
      setMessage('');
      setDone(msg);
      notify('Notice sent');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  const targetName = broadcast
    ? 'all shops'
    : (shops.find((s) => s.id === shopId)?.name ?? 'the selected shop');

  return (
    <div>
      <PageHeader
        title="Notices"
        subtitle="Superadmin → shop(s). Delivered realtime via socket + stored in the mobile app."
      />
      <form className="card" onSubmit={send}>
        <div className="grid3">
          <div style={{ gridColumn: 'span 3' }}>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </Field>
          </div>
        </div>
        <div style={{ height: 8 }} />
        <Field label="Message">
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} required />
        </Field>
        <div style={{ height: 10 }} />
        <Field label="Audience">
          <div className="row">
            <button
              type="button"
              className={broadcast ? 'btn btn-sm' : 'btn secondary btn-sm'}
              onClick={() => setBroadcast(true)}
            >
              All shops
            </button>
            <button
              type="button"
              className={!broadcast ? 'btn btn-sm' : 'btn secondary btn-sm'}
              onClick={() => setBroadcast(false)}
            >
              One shop
            </button>
          </div>
        </Field>
        {!broadcast && (
          <>
            <div style={{ height: 10 }} />
            <Field label="Shop">
              <Dropdown
                value={shopId}
                options={shops.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.shopCode})`,
                }))}
                onChange={setShopId}
                placeholder={shops.length ? 'Choose a shop…' : 'Loading shops…'}
                ariaLabel="Choose a shop"
              />
            </Field>
          </>
        )}
        <div style={{ height: 14 }} />
        <button type="submit" className="btn" disabled={busy || (!broadcast && !shopId)}>
          {busy ? 'Sending…' : `Send to ${targetName}`}
        </button>
      </form>

      <div style={{ height: 12 }} />
      <div className="card">
        <h3 style={{ margin: '0 0 8px' }}>Recent</h3>
        {recent.length === 0 ? (
          <EmptyState title="No notices yet" />
        ) : (
          recent.map((n) => (
            <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <strong>{n.title}</strong>
              <div className="muted">{n.message}</div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={done !== null}
        title="Notice sent"
        confirmLabel="OK"
        onClose={() => setDone(null)}
        onConfirm={() => setDone(null)}
      >
        <p>{done}</p>
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
