import { redirect } from "next/navigation";
import { hasFinanceSession } from "@/lib/financeDashboardAuth";
import { FinanceLoginForm } from "./FinanceLoginForm";

export const dynamic = "force-dynamic";

export default async function FinanceDashboardLoginPage() {
  if (await hasFinanceSession()) {
    redirect("/dashboard-financeiro");
  }
  return <FinanceLoginForm />;
}
