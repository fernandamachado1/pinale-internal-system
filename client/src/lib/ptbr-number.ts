export function toPtBrDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const asString = String(value);
  return asString.replace(".", ",");
}

export function fromPtBrDecimal(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Keep digits, comma, dot, minus
  let cleaned = trimmed.replace(/[^\d,.-]/g, "");

  // Collapse multiple commas/dots to a single decimal separator
  const commaParts = cleaned.split(",");
  if (commaParts.length > 2) cleaned = `${commaParts[0]},${commaParts.slice(1).join("")}`;

  const dotParts = cleaned.split(".");
  if (dotParts.length > 2) cleaned = `${dotParts[0]}.${dotParts.slice(1).join("")}`;

  // If the user uses pt-BR style "1.234,56", treat dot as thousands separator
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return cleaned.replace(/\./g, "").replace(",", ".");
  }

  // If only comma exists, treat it as decimal separator
  if (cleaned.includes(",")) return cleaned.replace(",", ".");

  return cleaned;
}

