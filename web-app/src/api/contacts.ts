import { api } from './client';

export type Contact = {
  id: string;
  name: string;
  phone: string;
  tier: 1 | 2 | 3;
};

export function listContacts() {
  return api<{ contacts: Contact[] }>('GET', '/contacts');
}

export function addContact(input: { name: string; phone: string; tier: 1 | 2 | 3 }) {
  return api<{ contact: Contact }>('POST', '/contacts', { body: input });
}

export function removeContact(id: string) {
  return api<{ ok: true }>('DELETE', `/contacts/${id}`);
}
