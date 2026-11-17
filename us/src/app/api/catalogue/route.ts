import { listPhoneVariants } from "@/lib/catalogue/service";
import { createCatalogueGetHandler } from "@/lib/catalogue/handler";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const GET = createCatalogueGetHandler((filters) =>
  listPhoneVariants(createSupabaseServerClient(), filters),
);
