import { exigirAdmin } from "@/lib/auth";
import { FrotasLista } from "@/components/FrotasLista";

export default async function AdminFrotasPage() {
  await exigirAdmin();
  return <FrotasLista />;
}
