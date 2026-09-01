import { exigirAdmin } from "@/lib/auth";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage() {
  await exigirAdmin();
  return <Dashboard />;
}
