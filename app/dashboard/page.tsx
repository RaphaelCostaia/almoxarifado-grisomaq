import { exigirSessao } from "@/lib/auth";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage() {
  await exigirSessao();
  return <Dashboard />;
}
