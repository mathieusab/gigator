import { useEffect, useState } from 'react';

import { createContact, type Contact } from '../services/contacts';

export default function ContactCreateForm({
  onCreated,
}: {
  onCreated?: (created: Contact) => void;
}) {
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      onCreated?.(created);
    } catch (e2) {
      setCreateError(e2 instanceof Error ? e2.message : 'Création impossible');
    } finally {
      setIsCreating(false);
    }
  }

  return (
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
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} inputMode="email" placeholder="contact@lieu.com" />
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
  );
}
