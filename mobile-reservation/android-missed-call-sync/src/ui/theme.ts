/** Minimal shared style tokens. */
import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#0B1220',
  card: '#161F33',
  cardBorder: '#26324D',
  text: '#E6ECF7',
  textDim: '#94A3B8',
  accent: '#3B82F6',
  accentText: '#FFFFFF',
  success: '#22C55E',
  warn: '#F59E0B',
  danger: '#EF4444',
  inputBg: '#0F1626',
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16 },
  h1: { color: colors.text, fontSize: 24, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 17, fontWeight: '600' },
  p: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.accentText, fontSize: 15, fontWeight: '700' },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonGhostText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
