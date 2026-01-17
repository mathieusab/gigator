import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '../lib/useAuth';
import { getContact } from '../services/contacts';
import { getGmailConnection, listGmailThreadsForEmail } from '../services/gmailProxy';
import { RefreshCw } from 'lucide-react';
import { CONCERT_STATUSES, listConcerts, patchConcert, type Concert, type ConcertStatus } from '../services/concerts';
import { listConcertFinancialItems, type ConcertFinancialItem } from '../services/concertFinancialItems';
import { formatConcertStatusFr } from '../lib/concertStatus';
import { bucketColors, bucketForStatus } from '../lib/concertBuckets';

function monthKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonthsUTC(monthStart: Date, deltaMonths: number): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + deltaMonths, 1));
}

function getUtcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

type MonthBucket = {
  key: string; // YYYY-MM (UTC)
  start: Date;
  end: Date;
  count: number;
};

type MonthDualBucket = MonthBucket & {
  contactedCount: number;
};

type MonthNetBucket = {
  key: string; // YYYY-MM (UTC)
  start: Date;
  end: Date;
  netCents: number;
};

function buildPastConcertsBuckets(concerts: Concert[], now: Date, months = 24): MonthBucket[] {
  const endMonthStart = getUtcMonthStart(now);
  const startMonthStart = addMonthsUTC(endMonthStart, -(months - 1));

  const buckets: MonthBucket[] = [];
  for (let i = 0; i < months; i++) {
    const start = addMonthsUTC(startMonthStart, i);
    const end = addMonthsUTC(startMonthStart, i + 1);
    buckets.push({ key: monthKeyUTC(start), start, end, count: 0 });
  }

  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  for (const c of concerts) {
    if (!c.date_start) continue;
    const d = new Date(c.date_start);
    if (!Number.isFinite(d.getTime())) continue;
    if (d.getTime() >= now.getTime()) continue; // only past concerts

    const key = monthKeyUTC(d);
    const bucket = bucketByKey.get(key);
    if (!bucket) continue;
    bucket.count += 1;
  }

  return buckets;
}

function buildContactedBuckets(concerts: Concert[], now: Date, months = 24): MonthBucket[] {
  const endMonthStart = getUtcMonthStart(now);
  const startMonthStart = addMonthsUTC(endMonthStart, -(months - 1));

  const buckets: MonthBucket[] = [];
  for (let i = 0; i < months; i++) {
    const start = addMonthsUTC(startMonthStart, i);
    const end = addMonthsUTC(startMonthStart, i + 1);
    buckets.push({ key: monthKeyUTC(start), start, end, count: 0 });
  }

  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  for (const c of concerts) {
    const iso = c.first_email_sent_at ?? null;
    if (!iso) continue;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) continue;
    if (d.getTime() >= now.getTime()) continue;

    const key = monthKeyUTC(d);
    const bucket = bucketByKey.get(key);
    if (!bucket) continue;
    bucket.count += 1;
  }

  return buckets;
}

function extractEmailsFromHeader(value?: string): string[] {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const matches = raw.match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g);
  if (!matches) return [];
  return matches.map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function headerContainsEmail(value: string | undefined, email: string): boolean {
  const target = String(email ?? '').trim().toLowerCase();
  if (!target) return false;
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!raw) return false;
  const emails = extractEmailsFromHeader(raw);
  return emails.includes(target) || raw.includes(`<${target}>`) || raw.includes(target);
}

function computeFirstOutboundToEmailIso(params: {
  threads: Array<{ messages?: Array<{ internalDate?: string; headers?: { from?: string; to?: string } }> }>;
  contactEmail: string;
  minInternalDateIso?: string | null;
}): string | null {
  const contact = params.contactEmail.trim().toLowerCase();
  if (!contact) return null;

  const minMs = (() => {
    const iso = params.minInternalDateIso ?? '';
    if (!iso) return Number.NEGATIVE_INFINITY;
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
  })();

  let bestMs = Number.POSITIVE_INFINITY;

  for (const t of params.threads ?? []) {
    const messages = Array.isArray(t.messages) ? t.messages : [];
    for (const m of messages) {
      const ms = m.internalDate ? new Date(m.internalDate).getTime() : Number.NaN;
      if (!Number.isFinite(ms)) continue;
      if (ms < minMs) continue;

      const fromRaw = String(m.headers?.from ?? '').replace(/\s+/g, ' ').trim();
      const toRaw = String(m.headers?.to ?? '').replace(/\s+/g, ' ').trim();

      // inbound? (from contains contact)
      const fromEmails = extractEmailsFromHeader(fromRaw);
      const fromIsContact = fromEmails.includes(contact) || fromRaw.toLowerCase().includes(contact);
      if (fromIsContact) continue;

      // outbound? (to contains contact)
      const looksOutbound = headerContainsEmail(toRaw, contact);
      if (!looksOutbound) continue;

      if (ms < bestMs) bestMs = ms;
    }
  }

  if (!Number.isFinite(bestMs) || bestMs === Number.POSITIVE_INFINITY) return null;
  return new Date(bestMs).toISOString();
}

function buildNetGainsBuckets(
  concerts: Concert[],
  items: ConcertFinancialItem[],
  now: Date,
  months = 24,
): MonthNetBucket[] {
  const endMonthStart = getUtcMonthStart(now);
  const startMonthStart = addMonthsUTC(endMonthStart, -(months - 1));

  const buckets: MonthNetBucket[] = [];
  for (let i = 0; i < months; i++) {
    const start = addMonthsUTC(startMonthStart, i);
    const end = addMonthsUTC(startMonthStart, i + 1);
    buckets.push({ key: monthKeyUTC(start), start, end, netCents: 0 });
  }

  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));
  const concertById = new Map(concerts.map((c) => [c.id, c]));

  for (const item of items) {
    const concert = concertById.get(item.concert_id);

    const dateIso = concert?.date_start ?? null;
    if (!dateIso) continue;
    const d = new Date(dateIso);
    if (!Number.isFinite(d.getTime())) continue;
    if (d.getTime() >= now.getTime()) continue;

    const key = monthKeyUTC(d);
    const bucket = bucketByKey.get(key);
    if (!bucket) continue;

    const delta = item.kind === 'income' ? item.amount_cents : -item.amount_cents;
    bucket.netCents += delta;
  }

  return buckets;
}

function formatCentsEUR(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function DualBarChart({ buckets }: { buckets: MonthDualBucket[] }) {
  const width = 860;
  const height = 320;
  const legendH = 22;
  const margin = { top: 16 + legendH, right: 12, bottom: 64, left: 44 };

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const max = Math.max(0, ...buckets.map((b) => Math.max(b.count, b.contactedCount)));
  const yMax = max === 0 ? 1 : max;

  const barGap = 2;
  const barW = Math.max(1, plotW / buckets.length - barGap);

  function y(count: number) {
    return margin.top + plotH * (1 - count / yMax);
  }

  function barHeight(count: number) {
    return plotH * (count / yMax);
  }

  const yTicks = Math.min(5, yMax);
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((i * yMax) / yTicks));

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Graphe du nombre de concerts passés et contactés par mois (24 derniers mois)"
      style={{ display: 'block', border: '1px solid #e5e7eb', borderRadius: 12, background: 'white' }}
    >
      {/* Legend */}
      <g>
        <rect
          x={margin.left}
          y={10}
          width={12}
          height={12}
          rx={2}
          fill={bucketColors('past').accent}
          stroke={bucketColors('past').text}
        />
        <text x={margin.left + 18} y={20} fontSize={12} fill="#374151">
          Joués
        </text>
        <rect
          x={margin.left + 100}
          y={10}
          width={12}
          height={12}
          rx={2}
          fill={bucketColors('contacted').accent}
          stroke={bucketColors('contacted').text}
        />
        <text x={margin.left + 118} y={20} fontSize={12} fill="#374151">
          Contactés
        </text>
      </g>

      {/* Y grid + labels */}
      {tickValues.map((v) => {
        const yy = y(v);
        return (
          <g key={v}>
            <line x1={margin.left} x2={width - margin.right} y1={yy} y2={yy} stroke="#f3f4f6" />
            <text x={margin.left - 8} y={yy + 4} textAnchor="end" fontSize={12} fill="#6b7280">
              {v}
            </text>
          </g>
        );
      })}

      {/* Bars (concerts base) */}
      {buckets.map((b, i) => {
        const x = margin.left + i * (barW + barGap);
        const yy = y(b.count);
        const h = barHeight(b.count);
        const isZero = b.count === 0;
        return (
          <g key={b.key}>
            <title>
              {b.key}: {b.count} concert{b.count === 1 ? '' : 's'}; {b.contactedCount} contacté{b.contactedCount === 1 ? '' : 's'}
            </title>
            <rect
              data-testid={`stats-bar-${b.key}`}
              data-count={b.count}
              x={x}
              y={yy}
              width={barW}
              height={h}
              rx={3}
              fill={isZero ? '#e5e7eb' : bucketColors('past').accent}
              stroke={isZero ? '#d1d5db' : bucketColors('past').text}
            />
          </g>
        );
      })}

      {/* Overlay bars (contacted) */}
      {buckets.map((b, i) => {
        const x = margin.left + i * (barW + barGap);
        const yy = y(b.contactedCount);
        const h = barHeight(b.contactedCount);
        const isZero = b.contactedCount === 0;
        const overlayW = Math.max(1, barW * 0.6);
        const overlayX = x + (barW - overlayW) / 2;

        return (
          <rect
            key={`contacted-${b.key}`}
            data-testid={`stats-contacted-bar-${b.key}`}
            data-count={b.contactedCount}
            x={overlayX}
            y={yy}
            width={overlayW}
            height={h}
            rx={3}
            fill={isZero ? 'transparent' : bucketColors('contacted').accent}
            stroke={isZero ? 'transparent' : bucketColors('contacted').text}
          />
        );
      })}

      {/* X labels (quarterly) */}
      {buckets.map((b, i) => {
        const show = i === 0 || i === buckets.length - 1 || i % 3 === 0;
        if (!show) return null;
        const x = margin.left + i * (barW + barGap) + barW / 2;
        return (
          <text
            key={b.key}
            x={x}
            y={height - margin.bottom + 22}
            textAnchor="middle"
            fontSize={11}
            fill="#6b7280"
          >
            {b.key}
          </text>
        );
      })}

      {/* Axis lines */}
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} stroke="#e5e7eb" />
      <line
        x1={margin.left}
        x2={width - margin.right}
        y1={height - margin.bottom}
        y2={height - margin.bottom}
        stroke="#e5e7eb"
      />
    </svg>
  );
}

function NetBarChart({ buckets }: { buckets: MonthNetBucket[] }) {
  const width = 860;
  const height = 320;
  const margin = { top: 16, right: 12, bottom: 64, left: 64 };

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Auto-scale the Y axis to the data range, while always including 0.
  // This avoids wasting vertical space when all values are positive (min=0)
  // or all values are negative (max=0).
  const min = Math.min(0, ...buckets.map((b) => b.netCents));
  const max = Math.max(0, ...buckets.map((b) => b.netCents));

  function niceStepCents(targetStep: number): number {
    const abs = Math.abs(targetStep);
    if (!Number.isFinite(abs) || abs === 0) return 1000;
    const pow10 = Math.pow(10, Math.floor(Math.log10(abs)));
    const scaled = abs / pow10;
    const niceScaled = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return niceScaled * pow10;
  }

  const rawRange = max - min;
  const safeRange = rawRange === 0 ? 1 : rawRange;
  const tickCount = 6; // number of labels including ends
  const step = niceStepCents(safeRange / (tickCount - 1));

  const yMin = min === 0 ? 0 : Math.floor(min / step) * step;
  const yMax = max === 0 ? 0 : Math.ceil(max / step) * step;
  const yRange = yMax - yMin === 0 ? 1 : yMax - yMin;

  const barGap = 2;
  const barW = Math.max(1, plotW / buckets.length - barGap);

  function y(value: number) {
    // Map [yMin, yMax] to [bottom, top]
    const t = (value - yMin) / yRange;
    return margin.top + plotH * (1 - t);
  }

  const y0 = y(0);

  const tickValues = Array.from({ length: tickCount }, (_, i) => yMin + i * step);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Graphe des gains nets par mois (24 derniers mois)"
      style={{ display: 'block', border: '1px solid #e5e7eb', borderRadius: 12, background: 'white' }}
    >
      {/* Y grid + labels */}
      {tickValues.map((v) => {
        const yy = y(v);
        const isZero = v === 0;
        return (
          <g key={v}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={yy}
              y2={yy}
              stroke={isZero ? '#e5e7eb' : '#f3f4f6'}
              strokeWidth={isZero ? 1.5 : 1}
            />
            <text x={margin.left - 8} y={yy + 4} textAnchor="end" fontSize={12} fill="#6b7280">
              {formatCentsEUR(v)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {buckets.map((b, i) => {
        const x = margin.left + i * (barW + barGap);
        const yy = y(b.netCents);
        const isPositive = b.netCents >= 0;
        const topY = isPositive ? yy : y0;
        const h = Math.abs(y0 - yy);

        return (
          <g key={b.key}>
            <title>
              {b.key}: {formatCentsEUR(b.netCents)}
            </title>
            <rect
              data-testid={`stats-net-bar-${b.key}`}
              data-net-cents={b.netCents}
              x={x}
              y={topY}
              width={barW}
              height={h}
              rx={3}
              fill={b.netCents === 0 ? '#e5e7eb' : isPositive ? '#86efac' : '#fca5a5'}
              stroke={b.netCents === 0 ? '#d1d5db' : isPositive ? '#22c55e' : '#ef4444'}
            />
          </g>
        );
      })}

      {/* X labels (quarterly) */}
      {buckets.map((b, i) => {
        const show = i === 0 || i === buckets.length - 1 || i % 3 === 0;
        if (!show) return null;
        const x = margin.left + i * (barW + barGap) + barW / 2;
        return (
          <text key={b.key} x={x} y={height - margin.bottom + 22} textAnchor="middle" fontSize={11} fill="#6b7280">
            {b.key}
          </text>
        );
      })}

      {/* Axis lines */}
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} stroke="#e5e7eb" />
      <line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} stroke="#e5e7eb" />
    </svg>
  );
}

export default function StatsPage() {
  const { session } = useAuth();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [financialItems, setFinancialItems] = useState<ConcertFinancialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const [items, fi] = await Promise.all([listConcerts(), listConcertFinancialItems()]);
        if (!isMounted) return;
        setConcerts(items);
        setFinancialItems(fi);
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load concerts');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const { buckets, netBuckets, totalPast, totalContacted, totalNetCents } = useMemo(() => {
    const now = new Date();
    const pastBuckets = buildPastConcertsBuckets(concerts, now, 24);
    const contactedBuckets = buildContactedBuckets(concerts, now, 24);
    const contactedByKey = new Map(contactedBuckets.map((b) => [b.key, b.count] as const));
    const buckets: MonthDualBucket[] = pastBuckets.map((b) => ({
      ...b,
      contactedCount: contactedByKey.get(b.key) ?? 0,
    }));

    const netBuckets = buildNetGainsBuckets(concerts, financialItems, now, 24);
    const totalPast = concerts.filter((c) => {
      if (!c.date_start) return false;
      const d = new Date(c.date_start);
      return Number.isFinite(d.getTime()) && d.getTime() < now.getTime();
    }).length;
    const totalContacted = concerts.filter((c) => Boolean(c.first_email_sent_at)).length;
    const totalNetCents = netBuckets.reduce((acc, b) => acc + b.netCents, 0);
    return { buckets, netBuckets, totalPast, totalContacted, totalNetCents };
  }, [concerts, financialItems]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(CONCERT_STATUSES.map((s) => [s, 0])) as Record<ConcertStatus, number>;
    for (const c of concerts) counts[c.status] += 1;
    return counts;
  }, [concerts]);

  return (
    <main className="container">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 className="h1">Statistiques</h1>
        <Link to="/" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" />
          Retour
        </Link>
      </header>

      {isLoading ? <p>Chargement…</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {!isLoading && !error ? (
        <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Statuts</h2>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Total concerts: {concerts.length}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            {CONCERT_STATUSES.map((s) => {
              const bucket = bucketForStatus(s);
              const c = bucketColors(bucket);

              return (
                <div
                  key={s}
                  data-testid={`stats-status-${s}`}
                  style={{
                    border: `1px solid ${c.border}`,
                    borderLeft: `6px solid ${c.accent}`,
                    borderRadius: 12,
                    background: c.bg,
                    padding: 12,
                  }}
                >
                  <div style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>
                    {formatConcertStatusFr(s)}
                  </div>
                  <div data-testid={`stats-status-count-${s}`} style={{ fontSize: 28, fontWeight: 700 }}>
                    {statusCounts[s]}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Concerts par mois</h2>
            <div style={{ color: '#6b7280', fontSize: 13 }}>
              Joués: {totalPast} · Contactés: {totalContacted}
            </div>
          </div>

          {totalContacted === 0 ? (
            <div
              style={{
                border: '1px solid #fde68a',
                background: '#fffbeb',
                color: '#92400e',
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Aucune date de contact enregistrée</div>
              <div style={{ marginBottom: 8 }}>
                Le graphe “Contactés” dépend de <code>first_email_sent_at</code>. Ouvre une fiche concert (avec Gmail connecté)
                pour enregistrer la date du premier email envoyé, ou lance le backfill ci-dessous.
              </div>
              <button
                type="button"
                disabled={isBackfilling}
                onClick={async () => {
                  const appAccessToken = (session as any)?.access_token as string | undefined;
                  if (!appAccessToken) {
                    setBackfillStatus('Session manquante. Merci de te reconnecter.');
                    return;
                  }

                  setIsBackfilling(true);
                  setBackfillStatus(null);

                  try {
                    // Fail fast with a clear message if Gmail isn't connected.
                    await getGmailConnection({ appAccessToken });

                    const toUpdate = concerts.filter((c) => !c.first_email_sent_at);
                    const contactCache = new Map<string, string | null>();

                    let updatedCount = 0;
                    let skippedCount = 0;
                    let skippedNoEmail = 0;
                    let skippedContactFetch = 0;
                    let skippedGmailError = 0;
                    let skippedNoOutbound = 0;
                    let skippedPatchError = 0;

                    let firstGmailError: string | null = null;

                    for (let i = 0; i < toUpdate.length; i++) {
                      const c = toUpdate[i];
                      setBackfillStatus(`Backfill Gmail: ${i + 1}/${toUpdate.length}…`);

                      let email = (c.venue_contact_email ?? '').trim();
                      if (!email && c.contact_id) {
                        if (!contactCache.has(c.contact_id)) {
                          try {
                            const contact = await getContact(c.contact_id);
                            contactCache.set(c.contact_id, contact.email?.trim() || null);
                          } catch {
                            contactCache.set(c.contact_id, null);
                            skippedContactFetch++;
                          }
                        }
                        email = (contactCache.get(c.contact_id) ?? '')?.trim() ?? '';
                      }

                      if (!email) {
                        skippedCount++;
                        skippedNoEmail++;
                        continue;
                      }

                      let threads;
                      try {
                        threads = await listGmailThreadsForEmail({
                          appAccessToken,
                          email,
                          maxThreads: 200,
                        });
                      } catch (e) {
                        skippedCount++;
                        skippedGmailError++;

                        const msg = e instanceof Error ? e.message : 'Failed to load Gmail threads';
                        if (!firstGmailError) firstGmailError = msg;

                        // Common case: backend has Gmail connection stored but proxy env vars are missing.
                        // In that scenario every request will fail; stop early with the root error.
                        if (msg.toLowerCase().includes('gmail proxy is not configured')) {
                          break;
                        }
                        continue;
                      }

                      let iso = computeFirstOutboundToEmailIso({
                        threads,
                        contactEmail: email,
                        minInternalDateIso: c.created_at,
                      });

                      // Fallback: if the concert was created after the outreach email, try without the min-date filter.
                      // This may occasionally pick an older unrelated thread, but it is better than never populating.
                      if (!iso) {
                        iso = computeFirstOutboundToEmailIso({
                          threads,
                          contactEmail: email,
                          minInternalDateIso: null,
                        });
                      }

                      if (!iso) {
                        skippedCount++;
                        skippedNoOutbound++;
                        continue;
                      }

                      try {
                        const updated = await patchConcert({ id: c.id, patch: { first_email_sent_at: iso } });
                        updatedCount++;
                        setConcerts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      } catch {
                        skippedCount++;
                        skippedPatchError++;
                      }
                    }

                    const details: string[] = [];
                    if (skippedNoEmail) details.push(`sans email: ${skippedNoEmail}`);
                    if (skippedContactFetch) details.push(`contacts illisibles: ${skippedContactFetch}`);
                    if (skippedGmailError) details.push(`erreurs Gmail: ${skippedGmailError}`);
                    if (skippedNoOutbound) details.push(`pas d'email sortant trouvé: ${skippedNoOutbound}`);
                    if (skippedPatchError) details.push(`échecs écriture DB: ${skippedPatchError}`);
                    const detailText = details.length ? ` (détails: ${details.join(' · ')})` : '';

                    const root = firstGmailError ? ` Première erreur Gmail: ${firstGmailError}` : '';
                    setBackfillStatus(
                      `Backfill terminé. Mis à jour: ${updatedCount}. Ignorés/échecs: ${skippedCount}.${detailText}${root}`,
                    );
                  } catch (e) {
                    setBackfillStatus(e instanceof Error ? e.message : 'Backfill échoué');
                  } finally {
                    setIsBackfilling(false);
                  }
                }}
                className="btn btn-warn"
              >
                <RefreshCw size={16} aria-hidden="true" />
                {isBackfilling ? 'Backfill en cours…' : 'Backfill Gmail → first_email_sent_at'}
              </button>
              {backfillStatus ? <div style={{ marginTop: 8 }}>{backfillStatus}</div> : null}
            </div>
          ) : null}

          <DualBarChart buckets={buckets} />

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Gains nets par mois</h2>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Total net (24 mois): {formatCentsEUR(totalNetCents)}</div>
          </div>
          <NetBarChart buckets={netBuckets} />
        </section>
      ) : null}
    </main>
  );
}
