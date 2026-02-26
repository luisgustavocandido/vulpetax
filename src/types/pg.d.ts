declare module "pg" {
  export class Pool {
    constructor(config?: unknown);
    query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
    end(): Promise<void>;
  }
}
