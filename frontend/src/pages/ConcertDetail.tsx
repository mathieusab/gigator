import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import GmailThreads from '../components/GmailThreads';
import { getContact, type Contact } from '../services/contacts';
import { getConcert, patchConcert, type Concert } from '../services/concerts';
import { listContactsForConcert, type ConcertContactLinkWithContact } from '../services/concertContactLinks';
import { bucketColors, deriveConcertBucket, formatBucketFr } from '../lib/concertBuckets';
import {
  listConcertFinancialItemsForConcert,
  type ConcertFinancialItem,
  CONCERT_FINANCIAL_CATEGORIES,
  type ConcertFinancialCategory,
} from '../services/concertFinancialItems';

function formatCentsEUR(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function pickColor(index: number) {
  const palette = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185'];
  return palette[index % palette.length];
}

function PieChart({
  title,
  values,
}: {
  title: string;
  values: Array<{ label: string; valueCents: number; color: string }>;
}) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;

  const total = values.reduce((acc, v) => acc + v.valueCents, 0);

  function arcPath(startAngle: number, endAngle: number) {
    const start = {
      x: cx + r * Math.cos(startAngle),
      y: cy + r * Math.sin(startAngle),
    };
    const end = {
      x: cx + r * Math.cos(endAngle),
      y: cy + r * Math.sin(endAngle),
    };
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  }

  let angle = -Math.PI / 2;
  const slices = total > 0 ? values.filter((v) => v.valueCents > 0) : [];

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'center' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
          {total === 0 ? (
            <g>
              <circle cx={cx} cy={cy} r={r} fill="#f3f4f6" stroke="#e5e7eb" />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#6b7280" fontSize={12}>
                Aucun
              </text>
            </g>
          ) : slices.length === 1 ? (
            <g>
              <circle cx={cx} cy={cy} r={r} fill={slices[0].color} stroke="white" strokeWidth={1} />
              <title>
                {slices[0].label}: {formatCentsEUR(slices[0].valueCents)}
              </title>
            </g>
          ) : (
            slices.map((s) => {
              const frac = s.valueCents / total;
              const start = angle;
              const end = angle + frac * 2 * Math.PI;
              angle = end;
              return (
                <path key={s.label} d={arcPath(start, end)} fill={s.color} stroke="white" strokeWidth={1}>
                  <title>
                    {s.label}: {formatCentsEUR(s.valueCents)}
                  </title>
                </path>
              );
            })
          )}
        </svg>

        {values.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {values.map((v) => (
              <div key={v.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: v.color, border: '1px solid #e5e7eb' }} />
                  <span style={{ color: '#374151' }}>{v.label}</span>
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{formatCentsEUR(v.valueCents)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#6b7280', fontSize: 13 }}>Aucune catégorie renseignée.</div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return 'Date à définir';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function ConcertDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const concertId = id;

  const [concert, setConcert] = useState<Concert | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [contactLinks, setContactLinks] = useState<ConcertContactLinkWithContact[]>([]);
  const [financialItems, setFinancialItems] = useState<ConcertFinancialItem[]>([]);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [isFinancialLoading, setIsFinancialLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPatchingFirstEmailSentAt, setIsPatchingFirstEmailSentAt] = useState(false);

  useEffect(() => {
    if (!concertId) {
      setError('Missing concert id');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const c = await getConcert(concertId);
        if (!isMounted) return;
        setConcert(c);
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load concert');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [concertId]);

  useEffect(() => {
    if (!concertId) return;
    let isMounted = true;
    void (async () => {
      setFinancialError(null);
      setIsFinancialLoading(true);
      try {
        const items = await listConcertFinancialItemsForConcert(concertId);
        if (!isMounted) return;
        setFinancialItems(items);
      } catch (e) {
        if (!isMounted) return;
        setFinancialError(e instanceof Error ? e.message : 'Failed to load financial items');
      } finally {
        if (isMounted) setIsFinancialLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [concertId]);

  useEffect(() => {
    const contactId = concert?.contact_id ?? null;
    if (!contactId) {
      setContact(null);
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const c = await getContact(contactId);
        if (!isMounted) return;
        setContact(c);
      } catch {
        if (!isMounted) return;
        setContact(null);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [concert?.contact_id]);

  useEffect(() => {
    if (!concertId) {
      setContactLinks([]);
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const links = await listContactsForConcert(concertId);
        if (!isMounted) return;
        setContactLinks(Array.isArray(links) ? links : []);
      } catch {
        // Keep details page functional even when the optional join table isn't available.
        if (!isMounted) return;
        setContactLinks([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [concertId]);

  const primaryEmail =
    contactLinks.find((l) => Boolean(l.contact?.email))?.contact.email ??
    contact?.email ??
    concert?.venue_contact_email ??
    null;

  async function maybePersistFirstEmailSentAt(iso: string | null) {
    if (!concert) return;
    if (!iso) return;
    if (isPatchingFirstEmailSentAt) return;

    const existing = concert.first_email_sent_at ?? null;
    if (existing) {
      const existingMs = new Date(existing).getTime();
      const nextMs = new Date(iso).getTime();
      if (Number.isFinite(existingMs) && Number.isFinite(nextMs) && existingMs <= nextMs) return;
    }

    setIsPatchingFirstEmailSentAt(true);
    try {
      const updated = await patchConcert({
        id: concert.id,
        patch: { first_email_sent_at: iso },
      });
      setConcert(updated);
    } catch {
      // Best-effort only: Gmail-derived enrichment should not break the page.
      // But keep a breadcrumb for debugging when the field never gets populated.
      console.warn('Failed to persist first_email_sent_at');
    } finally {
      setIsPatchingFirstEmailSentAt(false);
    }
  }

  const totals = useMemo(() => {
    let incomeCents = 0;
    let expenseCents = 0;
    const incomeByCategory = new Map<ConcertFinancialCategory, number>();
    const expenseByCategory = new Map<ConcertFinancialCategory, number>();

    for (const c of CONCERT_FINANCIAL_CATEGORIES) {
      incomeByCategory.set(c, 0);
      expenseByCategory.set(c, 0);
    }

    for (const item of financialItems) {
      if (item.kind === 'income') {
        incomeCents += item.amount_cents;
        incomeByCategory.set(item.label, (incomeByCategory.get(item.label) ?? 0) + item.amount_cents);
      } else {
        expenseCents += item.amount_cents;
        expenseByCategory.set(item.label, (expenseByCategory.get(item.label) ?? 0) + item.amount_cents);
      }
    }

    return {
      incomeCents,
      expenseCents,
      netCents: incomeCents - expenseCents,
      incomeByCategory,
      expenseByCategory,
    };
  }, [financialItems]);

  const hasAnyFinance = totals.incomeCents !== 0 || totals.expenseCents !== 0;

  const incomeSeries = useMemo(
    () =>
      CONCERT_FINANCIAL_CATEGORIES.map((c, i) => ({
        label: c,
        valueCents: totals.incomeByCategory.get(c) ?? 0,
        color: pickColor(i),
      })).filter((x) => x.valueCents > 0),
    [totals.incomeByCategory],
  );

  const expenseSeries = useMemo(
    () =>
      CONCERT_FINANCIAL_CATEGORIES.map((c, i) => ({
        label: c,
        valueCents: totals.expenseByCategory.get(c) ?? 0,
        color: pickColor(i),
      })).filter((x) => x.valueCents > 0),
    [totals.expenseByCategory],
  );

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Détail du concert</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/">Retour</Link>
          {concertId ? (
            <button type="button" onClick={() => navigate(`/concerts/${concertId}/edit`)}>
              Modifier
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Chargement…</p> : null}

      {!isLoading && !error && concert ? (
        <section style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {String(concert.title ?? '').trim() || concert.venue_name}
            </div>

            {(() => {
              const bucket = deriveConcertBucket(concert);
              const c = bucketColors(bucket);
              return (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: `1px solid ${c.border}`,
                      background: c.bg,
                      color: c.text,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{ width: 8, height: 8, borderRadius: 999, background: c.accent }}
                    />
                    {formatBucketFr(bucket)}
                  </span>
                </div>
              );
            })()}

            <div style={{ fontWeight: 600, marginTop: 4 }}>
              {concert.venue_id ? (
                <Link to={`/venues/${concert.venue_id}`}>{concert.venue_name}</Link>
              ) : (
                concert.venue_name
              )}
            </div>

            <div style={{ color: '#4b5563', marginTop: 4 }}>{formatDateTime(concert.date_start)}</div>
            <div style={{ color: '#4b5563' }}>
              {concert.city ? concert.city : ''}
              {concert.country ? (concert.city ? `, ${concert.country}` : concert.country) : ''}
            </div>

            {concert.address ? <div style={{ marginTop: 8 }}>{concert.address}</div> : null}

            {contactLinks.length || concert.contact_id || concert.venue_contact_email ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {contactLinks.length > 1 ? 'Contacts' : 'Contact'}
                </div>

                {contactLinks.length ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {contactLinks.map((l) => {
                      const label =
                        (l.contact?.full_name ?? '').trim() ||
                        (l.contact?.email ?? '').trim() ||
                        'Voir la fiche';

                      return (
                        <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <Link to={`/contacts/${l.contact_id}`}>{label}</Link>
                            {l.contact?.email ? (
                              <div style={{ color: '#4b5563', fontSize: 13 }}>{l.contact.email}</div>
                            ) : null}
                          </div>
                          {l.category ? (
                            <div style={{ color: '#374151', fontSize: 13, whiteSpace: 'nowrap' }}>{l.category}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    {concert.contact_id ? (
                      <div>
                        <Link to={`/contacts/${concert.contact_id}`}>
                          {(contact?.full_name ?? '').trim() ||
                            (contact?.email ?? '').trim() ||
                            'Voir la fiche'}
                        </Link>
                      </div>
                    ) : null}
                    {contact?.email || concert.venue_contact_email ? (
                      <div>{contact?.email ?? concert.venue_contact_email}</div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {concert.notes ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Notes</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{concert.notes}</div>
              </div>
            ) : null}
          </div>

          {primaryEmail ? (
              <GmailThreads
                email={String(primaryEmail)}
                minInternalDateIso={concert.created_at}
                onFirstSentEmailAtChange={maybePersistFirstEmailSentAt}
              />
          ) : null}

          {hasAnyFinance ? (
            <section style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Finances (résumé)</h2>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Net: {formatCentsEUR(totals.netCents)}</div>
              </div>

              {financialError ? (
                <p role="alert" style={{ color: 'crimson', marginTop: 8 }}>
                  {financialError}
                </p>
              ) : null}

              {isFinancialLoading ? <p style={{ marginTop: 8 }}>Chargement…</p> : null}

              {!isFinancialLoading ? (
                <div style={{ marginTop: 12, display: 'grid', gap: 16 }}>
                  <PieChart title="Recettes par catégorie" values={incomeSeries} />
                  <PieChart title="Dépenses par catégorie" values={expenseSeries} />
                  <div style={{ color: '#6b7280', fontSize: 13 }}>
                    Pour modifier ces montants, utilise le bouton “Modifier” puis la section Finances.
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
