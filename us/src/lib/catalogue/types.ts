export type PhoneVariant = {
  id: string;
  deviceCode?: string | null;
  variantCode?: string | null;
  modelId: string;
  ramGb?: number | null;
  storageGb: number;
  color: string;
  model: { id: string; name: string; brand: { name: string; slug: string } };
};

export type CatalogueFilters = {
  brand?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type CatalogueResult<T> = { data: T[]; count: number };
