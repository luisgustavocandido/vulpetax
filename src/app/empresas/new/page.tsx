import NewClientPageClient from "@/app/clients/new/NewClientPageClient";

export default function NewEmpresaPage() {
  return (
    <NewClientPageClient
      pageTitle="Nova empresa"
      successRedirectPath="/empresas"
    />
  );
}
