import { useEffect, useState } from 'react';
import { listContacts, addContact, removeContact, type Contact } from '../api/contacts';
import './ContactsPage.css';

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 — notified first',
  2: "Tier 2 — if tier 1 doesn't respond",
  3: 'Tier 3 — last escalation',
};

function formatPhone(raw: string) {
  return raw.startsWith('+') ? raw : `+${raw}`;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [tier,  setTier]  = useState<1 | 2 | 3>(1);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listContacts()
      .then((r) => setContacts(r.contacts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAdding(true);
    try {
      const res = await addContact({ name, phone, tier });
      setContacts((prev) => [...prev, res.contact].sort((a, b) => a.tier - b.tier));
      setName('');
      setPhone('');
      setTier(1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add contact');
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(id: string) {
    try {
      await removeContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove contact');
    }
  }

  const byTier = [1, 2, 3].map((t) => ({
    tier: t as 1 | 2 | 3,
    items: contacts.filter((c) => c.tier === t),
  }));

  return (
    <section className="contacts-page">
      <h1>Trusted contacts</h1>
      <p className="muted">
        When SOS is triggered — manually or by the deadman timer — we text your contacts in
        tier order until someone acknowledges. Add at least one tier-1 contact.
      </p>

      {loading && <p className="muted">Loading…</p>}
      {error   && <p className="error">{error}</p>}

      {!loading && (
        <div className="contacts-list">
          {byTier.map(({ tier: t, items }) => (
            <div key={t} className="contacts-tier">
              <h3 className="tier-label">{TIER_LABELS[t]}</h3>
              {items.length === 0 ? (
                <p className="tier-empty">No contacts yet.</p>
              ) : (
                <ul>
                  {items.map((c) => (
                    <li key={c.id} className="contact-row">
                      <div className="contact-info">
                        <span className="contact-name">{c.name}</span>
                        <span className="contact-phone">{formatPhone(c.phone)}</span>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm contact-remove"
                        onClick={() => onRemove(c.id)}
                        aria-label={`Remove ${c.name}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="contacts-add surface">
        <h2>Add a contact</h2>
        <form onSubmit={onAdd} className="add-form">
          <div className="add-row">
            <label className="field">
              <span className="field-label">Name</span>
              <input
                className="input"
                type="text"
                placeholder="e.g. Mum"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Phone (with country code)</span>
              <input
                className="input"
                type="tel"
                placeholder="+2348012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Escalation tier</span>
              <select
                className="input"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value) as 1 | 2 | 3)}
              >
                <option value={1}>Tier 1 — first</option>
                <option value={2}>Tier 2 — second</option>
                <option value={3}>Tier 3 — last</option>
              </select>
            </label>
          </div>
          {formError && <p className="error">{formError}</p>}
          <button className="btn btn-primary" type="submit" disabled={adding}>
            {adding ? 'Adding…' : 'Add contact'}
          </button>
        </form>
      </div>
    </section>
  );
}
