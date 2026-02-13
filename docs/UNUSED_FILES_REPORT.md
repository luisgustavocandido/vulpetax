# Relatório de Arquivos Não Utilizados

Gerado em: $(date)

## Resumo

Este relatório identifica arquivos que **podem** estar não utilizados no projeto. 
**IMPORTANTE:** Revise manualmente cada arquivo antes de remover.

## Arquivos Identificados como Não Utilizados

### ⚠️ Componentes

#### `components/AuthRedirect.tsx`
- **Status:** Possivelmente não usado
- **Motivo:** Não encontrado em nenhum import estático
- **Ação:** Verificar se é usado dinamicamente ou em Server Components
- **Recomendação:** Revisar manualmente antes de remover

#### `components/dashboard/ImportHistoryTable.tsx`
- **Status:** Possivelmente não usado
- **Motivo:** Não encontrado em nenhum import estático
- **Ação:** Verificar se é usado no dashboard
- **Recomendação:** Verificar `app/dashboard/page.tsx`

#### `components/dashboard/LineChart.tsx`
- **Status:** Possivelmente não usado
- **Motivo:** Não encontrado em nenhum import estático
- **Ação:** Verificar se é usado no dashboard
- **Recomendação:** Verificar `app/dashboard/page.tsx`

#### `components/tax/TaxSyncButton.tsx`
- **Status:** Possivelmente não usado
- **Motivo:** Não encontrado em nenhum import estático
- **Ação:** Verificar se é usado em TaxSyncPanel ou dinamicamente
- **Recomendação:** Verificar `components/tax/TaxSyncPanel.tsx`

### ⚠️ Biblioteca importCsv

**Nota:** Estes arquivos são usados através de barrel exports (`lib/importCsv/index.ts`).
O script pode não detectar corretamente devido a barrel exports.

#### `lib/importCsv/detect.ts`
- **Status:** Usado via barrel export
- **Verificação:** `lib/importCsv/index.ts` exporta `detectDelimiter`, `detectEncoding`
- **Usado em:** `app/api/clients/import/route.ts`
- **Recomendação:** **NÃO REMOVER** - usado via barrel export

#### `lib/importCsv/index.ts`
- **Status:** Barrel export - usado
- **Usado em:** `app/api/clients/import/route.ts`
- **Recomendação:** **NÃO REMOVER**

#### `lib/importCsv/mapHeaders.ts`
- **Status:** Usado via barrel export
- **Verificação:** `lib/importCsv/index.ts` exporta `mapHeadersFromCsv`
- **Usado em:** `app/api/clients/import/route.ts`
- **Recomendação:** **NÃO REMOVER** - usado via barrel export

#### `lib/importCsv/normalizeHeader.ts`
- **Status:** Usado via barrel export
- **Verificação:** `lib/importCsv/index.ts` exporta `normalizeHeader`
- **Usado em:** `app/api/clients/import/route.ts`
- **Recomendação:** **NÃO REMOVER** - usado via barrel export

#### `lib/importCsv/normalizers.ts`
- **Status:** Usado via barrel export
- **Verificação:** `lib/importCsv/index.ts` exporta `export * from "./normalizers"`
- **Usado em:** `app/api/clients/import/route.ts`
- **Recomendação:** **NÃO REMOVER** - usado via barrel export

#### `lib/importCsv/parseCsv.ts`
- **Status:** Usado via barrel export
- **Verificação:** `lib/importCsv/index.ts` exporta `parseCsv`
- **Usado em:** `app/api/clients/import/route.ts`
- **Recomendação:** **NÃO REMOVER** - usado via barrel export

#### `lib/importCsv/parseRow.ts`
- **Status:** Usado via barrel export
- **Verificação:** `lib/importCsv/index.ts` exporta `parseRow`
- **Usado em:** `app/api/clients/import/route.ts`
- **Recomendação:** **NÃO REMOVER** - usado via barrel export

## Arquivos Entrypoints (NÃO REMOVER)

Estes arquivos são entrypoints do Next.js ou scripts e **NÃO podem ser removidos**:

- Todos os arquivos em `app/**/page.tsx`
- Todos os arquivos em `app/**/layout.tsx`
- Todos os arquivos em `app/**/route.ts`
- `middleware.ts`
- Scripts referenciados em `package.json`:
  - `db/clearClients.ts`
  - `db/reset.ts`
  - `db/seed.ts`
  - `scripts/dedupeClientsByName.ts`

## Recomendações

### Arquivos para Revisar Manualmente

1. **`components/AuthRedirect.tsx`**
   - Buscar por uso dinâmico ou em Server Components
   - Verificar se é usado em algum lugar não detectado

2. **`components/dashboard/ImportHistoryTable.tsx`**
   - Verificar `app/dashboard/page.tsx`
   - Pode estar sendo usado dinamicamente

3. **`components/dashboard/LineChart.tsx`**
   - Verificar `app/dashboard/page.tsx`
   - Pode estar sendo usado dinamicamente

4. **`components/tax/TaxSyncButton.tsx`**
   - Verificar `components/tax/TaxSyncPanel.tsx`
   - Pode estar sendo usado dinamicamente

### Arquivos que NÃO devem ser removidos

- Todos os arquivos em `lib/importCsv/` - usados via barrel export
- Todos os entrypoints listados acima

## Validação

Após remover qualquer arquivo:

1. **Rodar build:**
   ```bash
   npm run build
   ```

2. **Verificar erros:**
   - Se houver erros de import, o arquivo estava sendo usado
   - Reverter a remoção se necessário

3. **Testar funcionalidades:**
   - Testar importação de CSV
   - Testar dashboard
   - Testar sync de TAX

## Como Usar o Script

```bash
# Modo seguro (apenas lista arquivos)
npx tsx find-unused-files.ts

# Modo dry-run (padrão)
DRY_RUN=true npx tsx find-unused-files.ts

# Modo de remoção (CUIDADO - não implementado por segurança)
DRY_RUN=false npx tsx find-unused-files.ts
```

## Limitações do Script

1. **Barrel Exports:** Pode não detectar corretamente arquivos usados via `index.ts`
2. **Dynamic Imports:** Pode não detectar imports dinâmicos (`import()`)
3. **Server Components:** Pode não detectar uso em Server Components
4. **String-based Imports:** Não detecta imports baseados em strings

## Próximos Passos

1. ✅ Revisar manualmente cada arquivo listado
2. ✅ Verificar uso dinâmico ou em Server Components
3. ✅ Testar build após remoção
4. ✅ Validar funcionalidades afetadas
