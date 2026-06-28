export const colors = {
  navy: '#1B2A3A',
  offwhite: '#F5F0E8',
  teal: '#4A7C7C',
  terracotta: '#E8845C',
  forest: '#2D5A4A',
  warmGray: '#8B8680',
} as const;

export const semantic = {
  primary: colors.navy,
  safe: colors.teal,
  alert: colors.terracotta,
  resolved: colors.forest,
  textMuted: colors.warmGray,
} as const;
