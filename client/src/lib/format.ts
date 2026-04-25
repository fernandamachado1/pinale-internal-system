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

export function formatQtyByUom(
  value: unknown,
  unitOfMeasure?: "UNIT" | "SQUARE_METER" | "METER",
  maxFractionDigits = 3,
): string {
  const raw = typeof value === "string" ? Number(value) : typeof value === "number" ? value : Number(value as any);
  const safeValue = Number.isFinite(raw) ? raw : 0;
  const digits = unitOfMeasure === "UNIT" ? 0 : maxFractionDigits;
  return safeValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}
