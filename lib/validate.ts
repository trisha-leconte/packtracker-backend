import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdString = z.string().regex(objectIdRegex, 'Invalid ObjectId');

// --- Tags ---
export const BoxTagEnum = z.enum([
  'open_first',
  'fragile',
  'heavy',
  'essentials',
  'donate',
]);

// --- Size ---
const BoxSizeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['S', 'M', 'L', 'XL']) }),
  z.object({ type: z.literal('custom') }),
]);

// --- Members ---
export const CreateMemberSchema = z.object({
  moveId: objectIdString,
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

// --- Boxes ---
export const CreateBoxSchema = z.object({
  moveId: objectIdString,
  creatorId: z.any().optional(),
  label: z.string().min(1).max(100),
  room: z.string().min(1).max(50),
  size: BoxSizeSchema.optional(),
  tags: z.array(BoxTagEnum).optional(),
  notes: z.string().max(1000).optional(),
  is_loose: z.boolean().optional(),
});

export const UpdateBoxSchema = z.object({
  status: z.enum(['unpacked', 'packed', 'in_transit', 'unpacking', 'done']).optional(),
  label: z.string().min(1).max(100).optional(),
  room: z.string().min(1).max(50).optional(),
  cover_image_url: z.string().url().optional().nullable(),
  size: BoxSizeSchema.optional(),
  tags: z.array(BoxTagEnum).optional(),
  notes: z.string().max(1000).optional().nullable(),
  is_loose: z.boolean().optional(),
});

// --- Items ---
export const AddItemsSchema = z.object({
  names: z.array(z.string().min(1).max(200)).min(1).max(50),
});

// --- Moves ---
export const CreateMoveSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
  targetDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  fromAddress: z.string().max(255).optional(),
  toAddress: z.string().max(255).optional(),
});

export const UpdateMoveSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  targetDate: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  fromAddress: z.string().max(255).optional(),
  toAddress: z.string().max(255).optional(),
  status: z.enum(['planning', 'in_progress', 'completed', 'unpacking']).optional(),
});

// --- Auth ---
export const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(50),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --- Inspections ---
export const CreateInspectionSchema = z.object({
  moveId: objectIdString,
  type: z.enum(['move_in', 'move_out']),
  date: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateInspectionSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  date: z.string().optional(),
});

// --- Shopping ---
export const CreateShoppingItemSchema = z.object({
  moveId: objectIdString,
  name: z.string().min(1).max(200),
  category: z.string().max(50).optional(),
});

export const UpdateShoppingItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  checked: z.boolean().optional(),
  category: z.string().max(50).optional(),
});

// --- Checklists ---
export const CreateChecklistItemSchema = z.object({
  moveId: objectIdString,
  text: z.string().min(1).max(200),
});

export const UpdateChecklistItemSchema = z.object({
  text: z.string().min(1).max(200).optional(),
  checked: z.boolean().optional(),
});
