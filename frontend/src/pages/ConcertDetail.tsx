import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import GmailThreads from '../components/GmailThreads';
import ConfirmDialog from '../components/ConfirmDialog';
import { getContact, type Contact } from '../services/contacts';
import { getConcert, type Concert } from '../services/concerts';
import {
  createConcertFinancialItem,
  deleteConcertFinancialItem,
  listConcertFinancialItemsForConcert,
  updateConcertFinancialItem,
  type ConcertFinancialItem,
  CONCERT_FINANCIAL_CATEGORIES,
  type ConcertFinancialCategory,
  type ConcertFinancialItemKind,
} from '../services/concertFinancialItems';

function parseAmountToCents(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) throw new Error('Le montant est requis.');
  const n = Number(normalized);
  if (!Number.isFinite(n)) throw new Error('Montant invalide.');
  const cents = Math.round(n * 100);
  if (cents < 0) throw new Error('Le montant doit être positif.');
  return cents;
}

function formatCentsEUR(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toIsoFromDateInput(localDate: string): string {
  // Interpret as local midnight.
  const d = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Date invalide.');
  return d.toISOString();
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
  const [financialItems, setFinancialItems] = useState<ConcertFinancialItem[]>([]);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [isFinancialLoading, setIsFinancialLoading] = useState(false);

  const [editingFinancialId, setEditingFinancialId] = useState<string | null>(null);
  const [kind, setKind] = useState<ConcertFinancialItemKind>('income');
  const [label, setLabel] = useState<ConcertFinancialCategory>('Cachet');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [isSavingFinancial, setIsSavingFinancial] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const totals = (() => {
    let incomeCents = 0;
    let expenseCents = 0;
    for (const item of financialItems) {
      if (item.kind === 'income') incomeCents += item.amount_cents;
      else expenseCents += item.amount_cents;
    }
    return {
      incomeCents,
      expenseCents,
      netCents: incomeCents - expenseCents,
    };
  })();

  function resetFinancialForm() {
    setEditingFinancialId(null);
    setKind('income');
    setLabel('Cachet');
    setAmount('');
    setEffectiveDate('');
  }

  async function submitFinancial(e: React.FormEvent) {
    e.preventDefault();
    if (!concertId) return;

    setFinancialError(null);
    setIsSavingFinancial(true);
    try {
      const amountCents = parseAmountToCents(amount);
      const effectiveAt = effectiveDate.trim() ? toIsoFromDateInput(effectiveDate.trim()) : null;
      const payload = { kind, label, amount_cents: amountCents, effective_at: effectiveAt };

      if (editingFinancialId) {
        const updated = await updateConcertFinancialItem(editingFinancialId, payload);
        setFinancialItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        resetFinancialForm();
        return;
      }

      const created = await createConcertFinancialItem(concertId, payload);
      setFinancialItems((prev) => [...prev, created]);
      resetFinancialForm();
    } catch (e) {
      setFinancialError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setIsSavingFinancial(false);
    }
  }

  function startEdit(item: ConcertFinancialItem) {
    setEditingFinancialId(item.id);
    setKind(item.kind);
    setLabel(item.label);
    setAmount(String((item.amount_cents / 100).toFixed(2)));
    setEffectiveDate(item.effective_at ? toDateInputValue(item.effective_at) : '');
  }

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
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
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {concert.venue_id ? (
                <Link to={`/venues/${concert.venue_id}`}>{concert.venue_name}</Link>
              ) : (
                concert.venue_name
              )}
            </div>
            <div style={{ color: '#4b5563' }}>{formatDateTime(concert.date_start)}</div>
            <div style={{ color: '#4b5563' }}>
              {concert.city ? concert.city : ''}
              {concert.country ? (concert.city ? `, ${concert.country}` : concert.country) : ''}
            </div>

            {concert.address ? <div style={{ marginTop: 8 }}>{concert.address}</div> : null}

            {concert.contact_id || concert.venue_contact_email ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Contact</div>
                {concert.contact_id ? (
                  <div>
                    <Link to={`/contacts/${concert.contact_id}`}>
                      {(contact?.full_name ?? '').trim() || (contact?.email ?? '').trim() || 'Voir la fiche'}
                    </Link>
                  </div>
                ) : null}
                {contact?.email || concert.venue_contact_email ? (
                  <div>{contact?.email ?? concert.venue_contact_email}</div>
                ) : null}
              </div>
            ) : null}

            {concert.notes ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Notes</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{concert.notes}</div>
              </div>
            ) : null}
          </div>

          {contact?.email || concert.venue_contact_email ? (
            <GmailThreads email={String(contact?.email ?? concert.venue_contact_email)} />
          ) : null}

          <section style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Finances</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ color: '#065f46' }}>Revenus: {formatCentsEUR(totals.incomeCents)}</span>
                <span style={{ color: '#991b1b' }}>Coûts: {formatCentsEUR(totals.expenseCents)}</span>
                <span style={{ fontWeight: 700 }}>Net: {formatCentsEUR(totals.netCents)}</span>
              </div>
            </div>

            {financialError ? (
              <p role="alert" style={{ color: 'crimson', marginTop: 8 }}>
                {financialError}
              </p>
            ) : null}

            {isFinancialLoading ? <p style={{ marginTop: 8 }}>Chargement…</p> : null}

            {!isFinancialLoading ? (
              <div style={{ marginTop: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        Type
                      </th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        Libellé
                      </th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        Date
                      </th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        Montant
                      </th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialItems.length ? (
                      financialItems.map((item) => {
                        const signed = item.kind === 'income' ? item.amount_cents : -item.amount_cents;
                        return (
                          <tr key={item.id}>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                              {item.kind === 'income' ? 'Revenu' : 'Coût'}
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{item.label}</td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
                              {item.effective_at ? formatDateTime(item.effective_at) : '—'}
                            </td>
                            <td
                              style={{
                                padding: '6px 8px',
                                borderBottom: '1px solid #f3f4f6',
                                textAlign: 'right',
                                color: item.kind === 'income' ? '#065f46' : '#991b1b',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {signed < 0 ? '-' : ''}
                              {formatCentsEUR(Math.abs(signed))}
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 8 }}>
                                <button type="button" onClick={() => startEdit(item)}>
                                  Modifier
                                </button>
                                <button type="button" onClick={() => setDeleteId(item.id)}>
                                  Supprimer
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: 8, color: '#6b7280' }}>
                          Aucune ligne pour l’instant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}

            <form onSubmit={submitFinancial} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span>Type</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value as ConcertFinancialItemKind)}>
                    <option value="income">Revenu</option>
                    <option value="expense">Coût</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 4 }}>
                  <span>Catégorie</span>
                  <select value={label} onChange={(e) => setLabel(e.target.value as ConcertFinancialCategory)}>
                    {CONCERT_FINANCIAL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span>Montant (€)</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </label>

                <label style={{ display: 'grid', gap: 4 }}>
                  <span>Date (optionnel)</span>
                  <input value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} type="date" />
                </label>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: 'flex-end' }}>
                  {editingFinancialId ? (
                    <button type="button" onClick={resetFinancialForm} disabled={isSavingFinancial}>
                      Annuler
                    </button>
                  ) : null}
                  <button type="submit" disabled={isSavingFinancial}>
                    {isSavingFinancial ? 'Enregistrement…' : editingFinancialId ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Supprimer la ligne ?"
        description="Cette action est irréversible."
        confirmText="Oui, supprimer"
        isConfirming={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteId(null);
        }}
        onConfirm={() => {
          if (!deleteId) return;
          setFinancialError(null);
          setIsDeleting(true);
          void (async () => {
            try {
              await deleteConcertFinancialItem(deleteId);
              setFinancialItems((prev) => prev.filter((x) => x.id !== deleteId));
              if (editingFinancialId === deleteId) resetFinancialForm();
              setDeleteId(null);
            } catch (e) {
              setFinancialError(e instanceof Error ? e.message : 'Suppression impossible');
            } finally {
              setIsDeleting(false);
            }
          })();
        }}
      />
    </main>
  );
}
