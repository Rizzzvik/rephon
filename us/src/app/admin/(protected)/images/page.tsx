import {redirect} from "next/navigation";
import {AdminImageManager} from "@/components/admin-image-manager";
import {requireStaff} from "@/lib/auth/staff";
export const dynamic="force-dynamic";
export default async function AdminImagesPage(){try{await requireStaff(["admin"]);}catch{redirect("/admin/login?next=%2Fadmin%2Fimages");}return <AdminImageManager/>;}
