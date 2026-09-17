// Compartilhado entre services.js (cadastro) e ui.js (edição), evitando import circular com supabase-service.js.
export function parseValor(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value > 999999.99) throw new Error('Informe um valor cobrado válido, como 150.00.');
  return Math.round(value * 100) / 100;
}
