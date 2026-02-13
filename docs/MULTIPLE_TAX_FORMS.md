# Múltiplos Formulários TAX por Cliente

## Visão Geral

O sistema agora suporta múltiplos formulários TAX por cliente (1:N), permitindo gerenciar formulários fiscais de diferentes anos fiscais para o mesmo cliente.

## ⚠️ Migração Obrigatória

**ANTES de usar esta funcionalidade, você DEVE aplicar a migração `drizzle/0010_client_tax_forms.sql`:**

```bash
# Opção 1: Usando Drizzle Kit (recomendado)
npm run db:migrate

# Opção 2: Aplicar manualmente via docker exec + psql
docker exec -i vulpetax-postgres psql -U user vulpetax < drizzle/0010_client_tax_forms.sql

# Opção 3: Copiar SQL diretamente no psql
docker exec -it vulpetax-postgres psql -U user vulpetax
# Depois cole o conteúdo completo de drizzle/0010_client_tax_forms.sql
```

**Verificar se migração foi aplicada:**

```bash
# Verificar tabelas críticas (recomendado)
npm run db:check

# Ou verificar via health endpoint
curl http://localhost:3000/api/health
```

**Sintomas se migração não foi aplicada:**
- Erro `42P01: relation "client_tax_forms" does not exist` ao criar TAX form
- Endpoint `/api/clients/[id]/tax/forms` retorna 500 com mensagem "Migração pendente"
- Health endpoint retorna `status: "warning"` com `missingTables: ["client_tax_forms"]`

**Se você ver esses erros, aplique a migração imediatamente antes de continuar.**

## Estrutura do Banco de Dados

### Nova Tabela: `client_tax_forms`

- **id** (uuid, PK): Identificador único do formulário
- **client_id** (uuid, FK): Referência ao cliente
- **tax_year** (integer, NOT NULL): Ano fiscal (ex: 2024, 2025)
- **status** (text, default 'draft'): Status do formulário (draft, submitted, archived)
- **Campos do formulário**: Todos os campos do `client_tax_profile` antigo (llcName, formationDate, etc.)
- **created_at**, **updated_at**: Timestamps

**Índices:**
- `client_tax_forms_client_id_idx`: Para buscar forms de um cliente
- `client_tax_forms_tax_year_idx`: Para buscar por ano
- `client_tax_forms_client_year_unique`: Constraint única (cliente + ano)

### Atualização: `client_tax_owners`

- Adicionado campo **tax_form_id** (uuid, FK, nullable): Vincula owners a um form específico
- Mantém **client_id** para compatibilidade com sistema antigo
- Índice: `client_tax_owners_tax_form_id_idx`

### Compatibilidade: `client_tax_profile`

- Tabela antiga mantida para compatibilidade (1:1)
- Não é mais usada para novos formulários
- Dados existentes podem ser migrados sob demanda

## APIs

### Listar formulários de um cliente
```
GET /api/clients/[id]/tax/forms
Response: { forms: [{ id, taxYear, status, createdAt, updatedAt }] }
```

### Criar novo formulário
```
POST /api/clients/[id]/tax/forms
Body: { taxYear: number }
Response: { taxFormId, taxYear, status }
```

### Obter formulário específico
```
GET /api/clients/[id]/tax/forms/[taxFormId]
Response: { taxForm, owners, client, computed }
```

### Atualizar formulário
```
PATCH /api/clients/[id]/tax/forms/[taxFormId]
Body: { ...campos do formulário }
Response: { taxForm, owners, computed }
```

### Obter formulário padrão (compatibilidade)
```
GET /api/clients/[id]/tax/default
Response: { taxFormId: string | null }
```
Retorna o draft mais recente, ou o mais recente de qualquer status, ou null.

## Rotas UI

### `/clients/[id]/tax`
- **Comportamento**: Redireciona automaticamente para o formulário padrão
- Se não houver form padrão, redireciona para `/clients/[id]/tax/new`

### `/clients/[id]/tax/new`
- **Criação**: Formulário simples para criar novo TAX form
- Campos: Ano fiscal (input number)
- Ao criar, redireciona para `/clients/[id]/tax/[taxFormId]`

### `/clients/[id]/tax/[taxFormId]`
- **Edição**: Tela de edição do formulário TAX específico
- Inclui seletor de formulários (TaxFormSelector)
- Usa componente TaxForm existente

## Componentes

### TaxFormSelector
- Lista todos os formulários do cliente
- Botão "+ Novo" para criar novo formulário
- Destaque visual para o formulário atual
- Links para navegar entre formulários

### TaxForm (atualizado)
- Aceita prop opcional `taxFormId`
- Se `taxFormId` presente, usa rota `/api/clients/[id]/tax/forms/[taxFormId]`
- Se ausente, usa rota antiga `/api/clients/[id]/tax` (compatibilidade)

## Migração de Dados Existentes

### Passo 1: Aplicar Migração do Schema

**OBRIGATÓRIO antes de usar múltiplos TAX forms:**

```bash
# Aplicar migração do schema
npm run db:migrate

# Verificar se foi aplicada corretamente
npm run db:check
```

Isso cria a tabela `client_tax_forms` e adiciona a coluna `tax_form_id` em `client_tax_owners`.

### Passo 2: Migração de Dados Existentes

**Estratégia Recomendada:**

1. **Migração sob demanda**: Quando um cliente acessar `/clients/[id]/tax`, o sistema:
   - Verifica se existe `client_tax_profile` antigo
   - Cria um `client_tax_forms` para o ano atual
   - Copia dados do profile antigo para o novo form
   - (Opcional) Marca profile antigo como migrado

2. **Migração em lote** (script futuro):
   ```sql
   INSERT INTO client_tax_forms (client_id, tax_year, status, ...)
   SELECT client_id, EXTRACT(YEAR FROM updated_at)::int, 'submitted', ...
   FROM client_tax_profile
   WHERE client_id IS NOT NULL;
   ```

## Sincronização com Google Sheets

### Status Atual
- O sync atual continua funcionando com `client_tax_profile` (compatibilidade)
- Para suportar múltiplos forms via sync, seria necessário:
  1. Adicionar coluna `tax_year` na planilha
  2. Usar chave composta: `client_id + tax_year`
  3. Atualizar `runTaxFormSync` para criar/atualizar `client_tax_forms`

### Recomendação
- Manter sync atual funcionando com profile antigo por enquanto
- Implementar suporte a múltiplos forms no sync em fase futura
- Ou criar sync separado para forms múltiplos

## Regras de Negócio

1. **Unicidade**: Um cliente não pode ter dois formulários para o mesmo ano fiscal
2. **Formulário Padrão**: 
   - Prioridade 1: Draft mais recente
   - Prioridade 2: Formulário mais recente de qualquer status
   - Se não houver nenhum, redireciona para criar novo
3. **Status**: 
   - `draft`: Em edição
   - `submitted`: Enviado/completo
   - `archived`: Arquivado (futuro)

## Testes Recomendados

1. ✅ Criar novo formulário para um cliente
2. ✅ Listar formulários de um cliente
3. ✅ Editar formulário específico
4. ✅ Navegar entre formulários diferentes
5. ✅ Acessar `/clients/[id]/tax` sem forms → redireciona para criar
6. ✅ Acessar `/clients/[id]/tax` com forms → redireciona para padrão
7. ✅ Validar que não permite criar dois forms para mesmo ano

## Próximos Passos (Opcional)

- [ ] Migração automática de `client_tax_profile` existente
- [ ] Suporte a múltiplos forms no sync Google Sheets
- [ ] Filtros/ordenação na listagem de forms
- [ ] Status "archived" e funcionalidade de arquivar
- [ ] Exportação/impressão de forms específicos
- [ ] Histórico de alterações por form
