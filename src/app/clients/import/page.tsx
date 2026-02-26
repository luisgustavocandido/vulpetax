import { redirect } from "next/navigation";

/**
 * Redirect legado: /clients/import -> /empresas/import
 */
export default function ImportClientsPageRedirect() {
  redirect("/empresas/import");
}
