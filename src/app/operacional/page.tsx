import { redirect } from "next/navigation";

/**
 * Redirect legado: /operacional -> /processos
 */
export default function OperacionalRedirect() {
  redirect("/processos");
}
