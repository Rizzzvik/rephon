import type { CatalogueResult, PhoneVariant } from "./types";
import { parseCatalogueFilters } from "./validation.ts";

type CatalogueReader = (filters: ReturnType<typeof parseCatalogueFilters>) => Promise<CatalogueResult<PhoneVariant>>;

export function createCatalogueGetHandler(readCatalogue: CatalogueReader) {
  return async function GET(request: Request): Promise<Response> {
    try {
      const filters = parseCatalogueFilters(new URL(request.url).searchParams);
      const result = await readCatalogue(filters);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("Catalogue API error", error);
      return Response.json({ error: "Catalogue is temporarily unavailable" }, { status: 503 });
    }
  };
}
