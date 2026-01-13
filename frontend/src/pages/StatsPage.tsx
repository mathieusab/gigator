import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { listConcerts, type Concert } from '../services/concerts';

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

function BarChart({ buckets }: { buckets: MonthBucket[] }) {
  const width = 860;
  const height = 320;
  const margin = { top: 16, right: 12, bottom: 64, left: 44 };

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const max = Math.max(0, ...buckets.map((b) => b.count));
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
      aria-label="Graphe du nombre de concerts passés par mois (24 derniers mois)"
      style={{ display: 'block', border: '1px solid #e5e7eb', borderRadius: 12, background: 'white' }}
    >
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

      {/* Bars */}
      {buckets.map((b, i) => {
        const x = margin.left + i * (barW + barGap);
        const yy = y(b.count);
        const h = barHeight(b.count);
        const isZero = b.count === 0;
        return (
          <g key={b.key}>
            <title>
              {b.key}: {b.count} concert{b.count === 1 ? '' : 's'}
            </title>
            <rect
              data-testid={`stats-bar-${b.key}`}
              data-count={b.count}
              x={x}
              y={yy}
              width={barW}
              height={h}
              rx={3}
              fill={isZero ? '#e5e7eb' : '#60a5fa'}
              stroke={isZero ? '#d1d5db' : '#3b82f6'}
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

export default function StatsPage() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const items = await listConcerts();
        if (!isMounted) return;
        setConcerts(items);
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

  const { buckets, totalPast } = useMemo(() => {
    const now = new Date();
    const buckets = buildPastConcertsBuckets(concerts, now, 24);
    const totalPast = concerts.filter((c) => {
      const d = new Date(c.date_start);
      return Number.isFinite(d.getTime()) && d.getTime() < now.getTime();
    }).length;
    return { buckets, totalPast };
  }, [concerts]);

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Statistiques</h1>
        <Link to="/">Retour</Link>
      </header>

      <p style={{ marginTop: 8, color: '#4b5563' }}>
        Graphe construit à partir des concerts passés (date de début &lt; maintenant), limité aux 24
        derniers mois.
      </p>

      {isLoading ? <p>Chargement…</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {!isLoading && !error ? (
        <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Concerts par mois</h2>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Total concerts passés: {totalPast}</div>
          </div>

          <BarChart buckets={buckets} />
        </section>
      ) : null}
    </main>
  );
}
