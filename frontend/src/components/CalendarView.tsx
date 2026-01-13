import { useMemo, useState } from 'react';

import type { Concert } from '../services/concerts';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toISODateUTC(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function isoDateFromDateTimeUTC(isoDateTime: string) {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  return toISODateUTC(d);
}

function makeUTCMonthDate(year: number, monthIndex0: number) {
  return new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0));
}

function addMonthsUTC(month: Date, delta: number) {
  return makeUTCMonthDate(month.getUTCFullYear(), month.getUTCMonth() + delta);
}

function daysInMonthUTC(month: Date) {
  const year = month.getUTCFullYear();
  const monthIdx = month.getUTCMonth();
  const next = makeUTCMonthDate(year, monthIdx + 1);
  const lastOfMonth = new Date(next.getTime() - 1);
  return lastOfMonth.getUTCDate();
}

function mondayIndexFromUTCDay(utcDay: number) {
  // JS: 0=Sun..6=Sat; we want 0=Mon..6=Sun
  return (utcDay + 6) % 7;
}

function formatMonthLabel(month: Date) {
  return `${month.getUTCFullYear()}-${pad2(month.getUTCMonth() + 1)}`;
}

function formatTimeUTC(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export default function CalendarView({
  concerts,
  initialMonth,
  onOpenConcert,
}: {
  concerts: Concert[];
  initialMonth?: Date;
  onOpenConcert: (id: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const base = initialMonth ?? new Date();
    return makeUTCMonthDate(base.getUTCFullYear(), base.getUTCMonth());
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const concertsByDay = useMemo(() => {
    const map = new Map<string, Concert[]>();
    for (const c of concerts) {
      if (!c.date_start) continue;
      const key = isoDateFromDateTimeUTC(c.date_start);
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }

    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.date_start as string).getTime() - new Date(b.date_start as string).getTime());
      map.set(key, arr);
    }

    return map;
  }, [concerts]);

  const days = useMemo(() => {
    const year = month.getUTCFullYear();
    const monthIdx = month.getUTCMonth();
    const count = daysInMonthUTC(month);

    const first = makeUTCMonthDate(year, monthIdx);
    const leadingBlanks = mondayIndexFromUTCDay(first.getUTCDay());

    const cells: Array<
      { kind: 'blank' } | { kind: 'day'; dateKey: string; dayNumber: number; count: number }
    > = [];

    for (let i = 0; i < leadingBlanks; i++) cells.push({ kind: 'blank' });

    for (let day = 1; day <= count; day++) {
      const d = new Date(Date.UTC(year, monthIdx, day));
      const dateKey = toISODateUTC(d);
      const items = concertsByDay.get(dateKey) ?? [];
      cells.push({ kind: 'day', dateKey, dayNumber: day, count: items.length });
    }

    return cells;
  }, [month, concertsByDay]);

  const selectedConcerts = selectedDate ? (concertsByDay.get(selectedDate) ?? []) : [];

  return (
    <section>
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <button
          type="button"
          onClick={() => setMonth((m) => addMonthsUTC(m, -1))}
          data-testid="calendar-prev-month"
        >
          Mois précédent
        </button>
        <div style={{ fontWeight: 700 }} data-testid="calendar-month-label">
          {formatMonthLabel(month)}
        </div>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonthsUTC(m, 1))}
          data-testid="calendar-next-month"
        >
          Mois suivant
        </button>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          marginTop: 12,
        }}
      >
        {['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'].map((label) => (
          <div key={label} style={{ textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
            {label}
          </div>
        ))}

        {days.map((cell, idx) => {
          if (cell.kind === 'blank') {
            return <div key={`b-${idx}`} />;
          }

          return (
            <button
              key={cell.dateKey}
              type="button"
              data-testid={`calendar-day-${cell.dateKey}`}
              onClick={() => setSelectedDate(cell.dateKey)}
              style={{
                padding: 10,
                minHeight: 56,
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: cell.count ? '#eef2ff' : 'white',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
              >
                <span style={{ fontWeight: 700 }}>{cell.dayNumber}</span>
                {cell.count ? (
                  <span
                    style={{ fontSize: 12, color: '#4f46e5' }}
                    aria-label={`${cell.count} concert(s)`}
                  >
                    {cell.count}
                  </span>
                ) : null}
              </div>
              {cell.count ? (
                <div
                  style={{ marginTop: 8, height: 6, borderRadius: 999, background: '#4f46e5' }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedDate ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
          onClick={() => setSelectedDate(null)}
        >
          <div
            style={{
              width: 'min(720px, 100%)',
              background: 'white',
              borderRadius: 12,
              padding: 16,
              border: '1px solid #e5e7eb',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>Concerts — {selectedDate}</h2>
              <button type="button" onClick={() => setSelectedDate(null)}>
                Fermer
              </button>
            </header>

            {selectedConcerts.length === 0 ? <p style={{ marginTop: 12 }}>Aucun concert.</p> : null}

            {selectedConcerts.length ? (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'grid', gap: 8 }}>
                {selectedConcerts.map((c) => (
                  <li
                    key={c.id}
                    style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{c.venue_name}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>
                          {formatTimeUTC(c.date_start)}
                        </div>
                      </div>
                      <button type="button" onClick={() => onOpenConcert(c.id)}>
                        Ouvrir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
