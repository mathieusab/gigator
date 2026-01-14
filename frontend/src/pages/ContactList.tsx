import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog';
import { createContact, deleteContact, listContacts, type Contact } from '../services/contacts';

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
  const [q, setQ] = useState('');

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [pendingDeleteContact, setPendingDeleteContact] = useState<Contact | null>(null);

  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  useEffect(() => {
    // Optional UX: allow pre-filling the inline create form from query params.
    // Example: /contacts?email=foo@bar.com
    const params = new URLSearchParams(window.location.search);
    const email = String(params.get('email') ?? '').trim();
    const fullName = String(params.get('full_name') ?? '').trim();
    const phone = String(params.get('phone') ?? '').trim();

    if (email && !newEmail) setNewEmail(email);
    if (fullName && !newFullName) setNewFullName(fullName);
    if (phone && !newPhone) setNewPhone(phone);
    // Intentionally run only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    const full_name = newFullName.trim() || null;
    const email = newEmail.trim() || null;
    const phone = newPhone.trim() || null;
    if (!full_name && !email && !phone) {
      setCreateError('Renseigne au moins un nom, un email ou un téléphone.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await createContact({ full_name, email, phone });
      setContacts((prev) => {
        const next = [created, ...prev.filter((c) => c.id !== created.id)];
        next.sort((a, b) => String(a.full_name ?? '').localeCompare(String(b.full_name ?? '')));
        return next;
      });
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
    } catch (e2) {
      setCreateError(e2 instanceof Error ? e2.message : 'Création impossible');
    } finally {
      setIsCreating(false);
    }
  }

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
            ? "Cette action est définitive. Si le contact est lié à des concerts/salles, la suppression peut être refusée."
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
          <button type="button" onClick={() => navigate('/')}>Retour</button>
        </div>
      </header>

      <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <form
          onSubmit={handleCreate}
          style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, display: 'grid', gap: 10 }}
        >
          <div style={{ fontWeight: 700 }}>Ajouter un contact</div>

          {createError ? (
            <p role="alert" style={{ color: 'crimson', margin: 0 }}>
              {createError}
            </p>
          ) : null}

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Nom</span>
              <input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Prénom Nom" />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Email</span>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} inputMode="email" placeholder="contact@salle.com" />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Téléphone</span>
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              inputMode="tel"
              placeholder="+33 6 12 34 56 78"
            />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={isCreating}>
              {isCreating ? 'Création…' : 'Ajouter'}
            </button>
          </div>
        </form>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Rechercher</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, email, téléphone…" />
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
                        style={{
                          background: deletingContactId === c.id ? '#f3f4f6' : '#fee2e2',
                          border: '1px solid #fecaca',
                          color: '#991b1b',
                        }}
                      >
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
