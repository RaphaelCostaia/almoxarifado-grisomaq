import { exigirAdmin } from "@/lib/auth";
import { AuditoriaLista } from "@/components/AuditoriaLista";

export default async function AdminAuditoriaPage() {
  await exigirAdmin();
  return <AuditoriaLista />;
}
