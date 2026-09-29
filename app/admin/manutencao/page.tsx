import { exigirAdmin } from "@/lib/auth";
import { ManutencaoPainel } from "@/components/ManutencaoPainel";

export default async function AdminManutencaoPage() {
  await exigirAdmin();
  return <ManutencaoPainel />;
}
