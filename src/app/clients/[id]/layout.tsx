/**
 * Layout mínimo: todas as rotas sob /clients/[id] redirecionam para /empresas/[id].
 * Apenas repassa children para o redirect executar.
 */
export default function ClientIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
