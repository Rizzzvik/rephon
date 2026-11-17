import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireStaff(["admin","super_admin","sales_admin","repair_admin","catalogue_manager","inventory_manager","location_manager","support_agent","inspector"]);
  } catch {
    redirect("/admin/login?next=%2Fadmin");
  }
  return <>{children}</>;
}
