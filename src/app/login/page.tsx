import { PasscodeInput } from "@/components/PasscodeInput";

type LoginPageProps = {
  searchParams?: {
    error?: string;
    callbackUrl?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const errorMessage =
    searchParams?.error === "rate_limit"
      ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
      : searchParams?.error === "invalid"
        ? "Passcode inválido. Tente novamente."
        : null;

  const callbackUrl = searchParams?.callbackUrl ?? "/clients";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-center text-lg font-semibold text-gray-900">
          Vulpeinc — Acesso interno
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          Informe o passcode interno para acessar o sistema.
        </p>

        {errorMessage && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form
          method="POST"
          action="/api/passcode-login"
          className="mt-6 space-y-4"
        >
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <div>
            <label
              htmlFor="passcode"
              className="block text-sm font-medium text-gray-700"
            >
              Passcode
            </label>
            <PasscodeInput />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
