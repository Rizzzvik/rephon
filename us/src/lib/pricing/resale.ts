export function getResaleListingPrice(input: { approvedOverride: unknown; sellingPrice: unknown }): number | null {
  for (const value of [input.approvedOverride, input.sellingPrice]) {
    if (value === null || value === undefined || value === "") continue;
    const amount = Number(value);
    if (Number.isFinite(amount) && amount >= 0) return amount;
  }
  return null;
}
