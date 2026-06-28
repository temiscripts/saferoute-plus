import { z } from 'zod';
import { db } from '../db/sqlite.js';
import { normalizePhone } from '../utils/phone.js';
import { newId, nowSeconds } from '../utils/ids.js';
import { HttpError } from '../middleware/errorHandler.js';

export const createContactSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(7),
  tier: z.coerce.number().int().min(1).max(3),
});

const listContacts = db.prepare(
  'SELECT id, name, phone, tier, created_at FROM contacts WHERE user_id = ? ORDER BY tier ASC, created_at ASC',
);
const insertContact = db.prepare(
  'INSERT INTO contacts (id, user_id, name, phone, tier, created_at) VALUES (?, ?, ?, ?, ?, ?)',
);
const deleteContact = db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?');

export function getContacts(req, res) {
  res.json({ contacts: listContacts.all(req.user.id) });
}

export function postContact(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) throw new HttpError(400, 'invalid_phone', 'Could not parse contact phone number');
    const id = newId();
    insertContact.run(id, req.user.id, req.body.name, phone, req.body.tier, nowSeconds());
    res.status(201).json({
      contact: { id, name: req.body.name, phone, tier: req.body.tier },
    });
  } catch (err) {
    next(err);
  }
}

export function removeContact(req, res, next) {
  try {
    const result = deleteContact.run(req.params.id, req.user.id);
    if (result.changes === 0) throw new HttpError(404, 'not_found', 'Contact not found');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
