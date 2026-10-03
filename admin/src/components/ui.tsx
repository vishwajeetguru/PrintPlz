import { useState } from 'react';

/* ---------- Badge ---------- */

type BadgeTone = 'green' | 'red' | 'blue' | 'amber' | 'gray';

export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'green' : 'red'}>{active ? 'ACTIVE' : 'OFF'}</Badge>;
}

/* ---------- Page header ---------- */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="muted page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </div>
  );
}

/* ---------- Form field ---------- */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

/* ---------- Stat card ---------- */

export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="card stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ---------- Copyable secret (password shown once) ---------- */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export function SecretValue({ value, caption }: { value: string; caption?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="secret">
      <code className="secret-code">{value}</code>
      <button
        type="button"
        className="btn secondary btn-sm"
        onClick={() => {
          void copyText(value).then((ok) => {
            setCopied(ok);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
      {caption && <span className="muted">{caption}</span>}
    </div>
  );
}
