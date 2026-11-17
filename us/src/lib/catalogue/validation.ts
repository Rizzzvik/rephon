import type { CatalogueFilters } from "./types";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 24;

export function parseCatalogueFilters(params: URLSearchParams): CatalogueFilters {
  const rawLimit = Number(params.get("limit"));
  const rawOffset = Number(params.get("offset"));
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  const brand = params.get("brand")?.trim().toLowerCase();
  const search = params.get("q")?.trim();

  return {
    ...(brand ? { brand } : {}),
    ...(search ? { search } : {}),
    limit,
    offset,
  };
}
