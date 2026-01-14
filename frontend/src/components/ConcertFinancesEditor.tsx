import { useEffect, useMemo, useState } from 'react';

import ConfirmDialog from './ConfirmDialog';
import {
  CONCERT_FINANCIAL_CATEGORIES,
  createConcertFinancialItem,
  deleteConcertFinancialItem,
  listConcertFinancialItemsForConcert,
  updateConcertFinancialItem,
  type ConcertFinancialCategory,
  type ConcertFinancialItem,
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

export default function ConcertFinancesEditor({ concertId }: { concertId: string }) {
  const [financialItems, setFinancialItems] = useState<ConcertFinancialItem[]>([]);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [isFinancialLoading, setIsFinancialLoading] = useState(false);

  const [editingFinancialId, setEditingFinancialId] = useState<string | null>(null);
  const [kind, setKind] = useState<ConcertFinancialItemKind>('income');
  const [label, setLabel] = useState<ConcertFinancialCategory>('Cachet');
  const [amount, setAmount] = useState('');
  const [isSavingFinancial, setIsSavingFinancial] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
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

  const totals = useMemo(() => {
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
  }, [financialItems]);

  function resetFinancialForm() {
    setEditingFinancialId(null);
    setKind('income');
    setLabel('Cachet');
    setAmount('');
  }

  async function submitFinancial(e: React.FormEvent) {
    e.preventDefault();

    setFinancialError(null);
    setIsSavingFinancial(true);
    try {
      const amountCents = parseAmountToCents(amount);
      const payload = { kind, label, amount_cents: amountCents };

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
  }

  return (
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
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Catégorie</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Montant</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {financialItems.length ? (
                financialItems.map((item) => {
                  const signed = item.kind === 'income' ? item.amount_cents : -item.amount_cents;
                  return (
                    <tr key={item.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{item.kind === 'income' ? 'Revenu' : 'Coût'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{item.label}</td>
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
                  <td colSpan={4} style={{ padding: 8, color: '#6b7280' }}>
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

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <label style={{ display: 'grid', gap: 4, flex: 1 }}>
            <span>Montant (€)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
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
    </section>
  );
}
