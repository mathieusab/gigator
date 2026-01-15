export const CONTACT_RELATION_TYPES = [
  'Gérant',
  'Ingé son',
  'Ingé lumière',
  'Organisateur',
  'Responsable bar',
  'Connaissance',
  'Membre du co-plateau',
] as const;

export type ContactRelationType = (typeof CONTACT_RELATION_TYPES)[number];
