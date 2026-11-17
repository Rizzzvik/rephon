import { redirect } from "next/navigation";
import { AdminImportConsole } from "@/components/admin-import-console";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

export default async function AdminImportsPage() {
  try { await requireStaff(["catalogue_manager", "inventory_manager"], "imports.manage"); }
  catch { redirect("/admin/login?next=%2Fadmin%2Fimports"); }
  return <AdminImportConsole />;
}
