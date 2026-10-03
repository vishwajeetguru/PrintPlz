import { useEffect, useState } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Modal } from '../components/Modal';
import { Field, PageHeader } from '../components/ui';
import { api } from '../lib/api';

export function Maintenance() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ maintenanceMode: boolean; message: string }>('/api/system/status')
      .then((s) => {
        setEnabled(s.maintenanceMode);
        setMessage(s.message);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ maintenanceMode: boolean }>('/api/system/maintenance', {
        method: 'PUT',
        body: JSON.stringify({ enabled, message }),
      });
      setDone(
        res.maintenanceMode
          ? 'Maintenance ON — mobile apps show the notice.'
          : 'Maintenance OFF — shops are back to normal.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Maintenance mode"
        subtitle="When ON, the vendor mobile app blocks interaction and shows your message (realtime)."
      />
      <div className="card">
        <Field label="Status">
          <Dropdown
            value={enabled ? 'on' : 'off'}
            options={[
              { value: 'off', label: '○ Off — shops operate normally' },
              { value: 'on', label: '● On — apps show maintenance notice' },
            ]}
            onChange={(v) => setEnabled(v === 'on')}
            ariaLabel="Maintenance status"
          />
        </Field>
        <div style={{ height: 10 }} />
        <Field label="Message">
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div style={{ height: 12 }} />
        <button type="button" className="btn" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <Modal
        open={done !== null}
        title="Maintenance updated"
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
