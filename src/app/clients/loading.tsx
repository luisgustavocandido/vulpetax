export default function ClientsLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="mb-6 h-8 w-32 rounded bg-gray-200" />
      <div className="mb-4 flex gap-4">
        <div className="h-10 w-64 rounded bg-gray-200" />
        <div className="h-10 w-24 rounded bg-gray-200" />
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        Carregando…
      </div>
    </div>
  );
}
