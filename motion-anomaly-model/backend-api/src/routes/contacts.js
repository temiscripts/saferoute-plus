import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getContacts,
  postContact,
  removeContact,
  createContactSchema,
} from '../controllers/contactsController.js';

export const contactsRouter = Router();
contactsRouter.use(requireAuth);
contactsRouter.get('/', getContacts);
contactsRouter.post('/', validateBody(createContactSchema), postContact);
contactsRouter.delete('/:id', removeContact);
