export function brl(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `R$ ${safeValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTimeBR(value: Date | string | number): string {
  return new Date(value).toLocaleString("pt-BR");
}

export function formatQty(value: number, fractionDigits = 3): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

