import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog';
import ContactCreateForm from '../components/ContactCreateForm';
import { deleteContact, listContacts, type Contact } from '../services/contacts';
import { ArrowLeft, Trash2 } from 'lucide-react';

function displayName(c: Contact): string {
  const name = String(c.full_name ?? '').trim();
  if (name) return name;
  const email = String(c.email ?? '').trim();
  return email || 'Contact';
}

export default function ContactList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createFlash, setCreateFlash] = useState<string | null>(null);
  const [createFlashKind, setCreateFlashKind] = useState<'success' | 'info'>('success');
  const createFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (createFlashTimeoutRef.current) clearTimeout(createFlashTimeoutRef.current);
    };
  }, []);
  const [q, setQ] = useState('');

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [pendingDeleteContact, setPendingDeleteContact] = useState<Contact | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDeleteContact) return;
    setDeleteError(null);

    const c = pendingDeleteContact;
    const name = displayName(c);
    setDeletingContactId(c.id);
    try {
      await deleteContact(c.id);
      setContacts((prev) => prev.filter((item) => item.id !== c.id));
      setPendingDeleteContact(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Suppression impossible';
      setDeleteError(`Suppression de "${name}" impossible. ${msg}`);
    } finally {
      setDeletingContactId((current) => (current === c.id ? null : current));
    }
  }

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const items = await listContacts();
        if (!isMounted) return;
        setContacts(items);
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load contacts');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);


  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((c) => {
      const hay = [c.full_name, c.email, c.phone, c.organization, c.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [contacts, q]);


  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <ConfirmDialog
        open={pendingDeleteContact !== null}
        title={
          pendingDeleteContact
            ? `Supprimer "${displayName(pendingDeleteContact)}" ?`
            : 'Supprimer ce contact ?'
        }
        description={
          pendingDeleteContact
            ? "Cette action est définitive. Si le contact est lié à des concerts/lieux, la suppression peut être refusée."
            : undefined
        }
        confirmText="Oui, supprimer"
        cancelText="Annuler"
        isConfirming={pendingDeleteContact ? deletingContactId === pendingDeleteContact.id : false}
        onCancel={() => {
          if (pendingDeleteContact && deletingContactId === pendingDeleteContact.id) return;
          setPendingDeleteContact(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Contacts</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-sm" onClick={() => navigate('/')}>
            <ArrowLeft size={16} aria-hidden="true" />
            Retour
          </button>
        </div>
      </header>

      <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {createFlash ? (
          <p
            role="status"
            style={{
              margin: 0,
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d1fae5',
              background: createFlashKind === 'success' ? '#ecfdf5' : '#eff6ff',
              color: createFlashKind === 'success' ? '#065f46' : '#1d4ed8',
            }}
          >
            {createFlash}
          </p>
        ) : null}

        <ContactCreateForm
          onCreated={(created) => {
            setContacts((prev) => {
              const next = [created, ...prev.filter((c) => c.id !== created.id)];
              next.sort((a, b) => String(a.full_name ?? '').localeCompare(String(b.full_name ?? '')));
              return next;
            });
          }}
          onResult={(result) => {
            if (createFlashTimeoutRef.current) clearTimeout(createFlashTimeoutRef.current);

            const label = displayName(result.contact);
            if (result.existed) {
              setCreateFlashKind('info');
              setCreateFlash(`Contact existant réutilisé${label ? ` : ${label}` : ''}`);
            } else {
              setCreateFlashKind('success');
              setCreateFlash(`Contact ajouté${label ? ` : ${label}` : ''}`);
            }

            createFlashTimeoutRef.current = setTimeout(() => setCreateFlash(null), 3000);
          }}
        />

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Rechercher</span>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, email, téléphone…"
          />
        </label>

        {isLoading ? <p>Chargement…</p> : null}
        {error ? (
          <p role="alert" style={{ color: 'crimson' }}>
            {error}
          </p>
        ) : null}

        {deleteError ? (
          <p role="alert" style={{ color: 'crimson' }}>
            {deleteError}
          </p>
        ) : null}

        {!isLoading && !error ? (
          filtered.length === 0 ? (
            <p>Aucun contact.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {filtered.map((c) => (
                <li
                  key={c.id}
                  style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/contacts/${c.id}`)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        font: 'inherit',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{displayName(c)}</div>
                      <div style={{ color: '#4b5563' }}>
                        {c.role ? c.role : ''}
                        {c.organization ? (c.role ? ` — ${c.organization}` : c.organization) : ''}
                      </div>
                      {c.email ? <div style={{ color: '#4b5563' }}>{c.email}</div> : null}
                      {c.phone ? <div style={{ color: '#4b5563' }}>{c.phone}</div> : null}
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDeleteContact(c);
                        }}
                        disabled={deletingContactId === c.id}
                        aria-label={`Supprimer ${displayName(c)}`}
                        className="btn btn-danger btn-sm"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </main>
  );
}
