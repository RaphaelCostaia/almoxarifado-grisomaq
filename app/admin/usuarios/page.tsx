import { exigirAdmin } from "@/lib/auth";
import { UsuariosLista } from "@/components/UsuariosLista";

export default async function AdminUsuariosPage() {
  await exigirAdmin();
  return <UsuariosLista />;
}
