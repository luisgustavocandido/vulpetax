import { redirect } from "next/navigation";

/**
 * Redirect legado: /clients/new -> /empresas/new
 */
export default function NewClientPageRedirect() {
  redirect("/empresas/new");
}
