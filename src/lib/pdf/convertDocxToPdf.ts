/**
 * Converte DOCX para PDF via serviço HTTP.
 * Suporta Gotenberg (padrão) e CloudConvert (fallback).
 * Retry para erros transitórios (ECONNRESET, ETIMEDOUT, 502, 503, 504).
 */

export type PdfConverterProvider = "gotenberg" | "cloudconvert";

export function getPdfConverterProvider(): PdfConverterProvider {
  const p = process.env.PDF_CONVERTER_PROVIDER?.toLowerCase();
  if (p === "cloudconvert") return "cloudconvert";
  return "gotenberg";
}

function getTimeoutMs(): number {
  const v = process.env.PDF_CONVERSION_TIMEOUT_MS;
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 60_000;
}

function getRetryCount(): number {
  const v = process.env.PDF_CONVERSION_RETRY_COUNT;
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const codes = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"];
  if (codes.some((c) => msg.includes(c))) return true;
  if (/5[0-2][0-9]|503|504/.test(msg)) return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Converte DOCX para PDF via Gotenberg.
 * POST /forms/libreoffice/convert com multipart file (filename .docx).
 */
async function convertWithGotenberg(docx: Buffer): Promise<Buffer> {
  const baseUrl = process.env.GOTENBERG_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "GOTENBERG_URL não configurado. Defina a variável de ambiente para usar conversão DOCX→PDF."
    );
  }

  const timeoutMs = getTimeoutMs();
  const url = `${baseUrl.replace(/\/$/, "")}/forms/libreoffice/convert`;
  const formData = new FormData();
  formData.append(
    "files",
    new Blob([new Uint8Array(docx)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "document.docx"
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gotenberg retornou ${res.status}: ${text.slice(0, 500)}`);
    }

    const pdf = await res.arrayBuffer();
    return Buffer.from(pdf);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Converte DOCX para PDF via CloudConvert.
 * Job: import/upload -> convert -> export/url, polling com backoff.
 */
async function convertWithCloudConvert(docx: Buffer): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "CLOUDCONVERT_API_KEY não configurado. Defina para usar provider cloudconvert."
    );
  }

  const timeoutMs = getTimeoutMs();
  const baseUrl =
    process.env.CLOUDCONVERT_SANDBOX === "true"
      ? "https://api.sandbox.cloudconvert.com"
      : "https://api.cloudconvert.com";

  let jobId: string | null = null;

  try {
    // 1) Criar job
    const jobRes = await fetch(`${baseUrl}/v2/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tasks: {
          "upload-file": { operation: "import/upload" },
          "convert-docx": {
            operation: "convert",
            input: "upload-file",
            input_format: "docx",
            output_format: "pdf",
          },
          "export-pdf": { operation: "export/url", input: "convert-docx" },
        },
        tag: "pos-venda-llc",
      }),
    });

    if (!jobRes.ok) {
      const err = await jobRes.text();
      throw new Error(`CloudConvert job falhou: ${jobRes.status} ${err.slice(0, 300)}`);
    }

    const job = (await jobRes.json()) as {
      data: { id: string; tasks: Array<{ id: string; name: string }> };
    };
    jobId = job.data.id;
    const uploadTask = job.data.tasks.find((t) => t.name === "upload-file");
    if (!uploadTask?.id) throw new Error("CloudConvert: task upload não encontrada");

    // 2) Upload
    const uploadRes = await fetch(`${baseUrl}/v2/import/upload/${uploadTask.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: (() => {
        const fd = new FormData();
        fd.append("file", new Blob([new Uint8Array(docx)]), "document.docx");
        return fd;
      })(),
    });

    if (!uploadRes.ok) {
      throw new Error(`CloudConvert upload falhou: ${uploadRes.status}`);
    }

    // 3) Polling com backoff
    const maxAttempts = Math.min(30, Math.floor(timeoutMs / 2000));
    let pollInterval = 1500;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(pollInterval);
      pollInterval = Math.min(pollInterval * 1.2, 5000);

      const statusRes = await fetch(`${baseUrl}/v2/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!statusRes.ok) throw new Error(`CloudConvert status falhou: ${statusRes.status}`);

      const status = (await statusRes.json()) as {
        data: {
          status: string;
          tasks: Array<{ name: string; status: string; result?: { files?: Array<{ url: string }> } }>;
        };
      };

      if (status.data.status === "finished") {
        const exp = status.data.tasks.find((t) => t.name === "export-pdf");
        const url = exp?.result?.files?.[0]?.url;
        if (!url) throw new Error("CloudConvert: URL de export não encontrada");

        const pdfRes = await fetch(url);
        if (!pdfRes.ok) throw new Error(`CloudConvert download falhou: ${pdfRes.status}`);
        return Buffer.from(await pdfRes.arrayBuffer());
      }

      if (status.data.status === "error") {
        const failed = status.data.tasks.find((t) => t.status === "error");
        throw new Error(
          `CloudConvert job erro: ${JSON.stringify((failed as { message?: string })?.message ?? failed)}`
        );
      }
    }

    throw new Error("CloudConvert: timeout aguardando conversão");
  } catch (err) {
    throw err;
  }
}

async function convertWithRetry(
  docx: Buffer,
  provider: PdfConverterProvider
): Promise<Buffer> {
  const maxRetries = getRetryCount();
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (provider === "gotenberg") return await convertWithGotenberg(docx);
      return await convertWithCloudConvert(docx);
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isTransientError(err)) {
        const backoff = 500 * Math.pow(1.5, attempt);
        await sleep(backoff);
      } else {
        throw err;
      }
    }
  }

  throw lastErr;
}

/**
 * Converte buffer DOCX em PDF usando o provider configurado.
 */
export async function convertDocxToPdf(docx: Buffer): Promise<Buffer> {
  const provider = getPdfConverterProvider();
  return convertWithRetry(docx, provider);
}
