# Aplicar Migração client_tax_forms

## Problema

Erro ao criar TAX form:
```
error: relation "client_tax_forms" does not exist
code: '42P01'
```

## Solução

A tabela `client_tax_forms` não existe no banco de dados. É necessário aplicar a migração.

## Opção 1: Usando Drizzle Kit (recomendado)

```bash
npm run db:migrate
```

Isso aplicará todas as migrações pendentes, incluindo `drizzle/0010_client_tax_forms.sql`.

## Opção 2: Aplicar SQL manualmente

Se preferir aplicar manualmente:

```bash
# Conectar ao banco e executar o SQL
psql $DATABASE_URL -f drizzle/0010_client_tax_forms.sql
```

Ou copiar o conteúdo de `drizzle/0010_client_tax_forms.sql` e executar no seu cliente PostgreSQL.

## Verificar se foi aplicada

Após aplicar, verifique se a tabela existe:

**Opção 1: Usando script de verificação (recomendado)**
```bash
npm run db:check
```

**Opção 2: Via health endpoint**
```bash
curl http://localhost:3000/api/health
```

**Opção 3: SQL direto**
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'client_tax_forms'
);
```

Deve retornar `true` ou o script deve mostrar `✅ client_tax_forms: existe`.

## Após aplicar

1. Reiniciar o servidor Next.js (`npm run dev`)
2. Tentar criar TAX novamente em `/tax/new`
