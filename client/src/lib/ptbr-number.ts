export function toPtBrDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const asString = String(value);
  return asString.replace(".", ",");
}

export function fromPtBrDecimal(value: string, maxFractionDigits?: number): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Keep digits, comma, dot, minus
  let cleaned = trimmed.replace(/[^\d,.-]/g, "");

  // Keep minus sign only at the beginning
  cleaned = cleaned.replace(/(?!^)-/g, "");

  // Collapse multiple commas/dots to a single decimal separator
  const commaParts = cleaned.split(",");
  if (commaParts.length > 2) cleaned = `${commaParts[0]},${commaParts.slice(1).join("")}`;

  const dotParts = cleaned.split(".");
  if (dotParts.length > 2) cleaned = `${dotParts[0]}.${dotParts.slice(1).join("")}`;

  // If the user uses pt-BR style "1.234,56", treat dot as thousands separator
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // If only comma exists, treat it as decimal separator
    cleaned = cleaned.replace(",", ".");
  }

  if (maxFractionDigits !== undefined) {
    const [integerPart, fractionPart] = cleaned.split(".");
    if (fractionPart !== undefined) {
      return `${integerPart}.${fractionPart.slice(0, Math.max(0, maxFractionDigits))}`;
    }
  }

  return cleaned;
}
