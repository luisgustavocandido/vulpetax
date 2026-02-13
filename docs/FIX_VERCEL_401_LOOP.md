# Fix: Loop 401 no Vercel (/clients ↔ /login)

## Status Atual

✅ **Código já está correto**: `src/app/clients/page.tsx` usa acesso direto ao banco (`queryClients()`) ao invés de fetch para `/api/clients`.

## Possíveis Causas do 401 em Produção

### 1. Cache de Build Antigo na Vercel

O código correto pode não estar deployado ainda, ou há cache de uma versão antiga.

**Solução:**
```bash
# Fazer redeploy limpo na Vercel
# Vercel Dashboard → Deployments → Redeploy (com "Clear Build Cache")
```

### 2. Tabela `sync_state` Ausente

Embora não cause 401 diretamente, pode causar erros que são interpretados incorretamente.

**Solução:**
```bash
# Aplicar migrações no banco de produção
export DATABASE_URL="postgresql://...produção..."
npm run db:migrate

# OU usar o script automático
DATABASE_URL="postgresql://...produção..." npx tsx apply-prod-migration.ts
```

### 3. Cookie de Sessão Não Está Sendo Enviado

Se houver algum componente client-side fazendo fetch para `/api/clients` sem `credentials: "include"`.

**Verificação:**
- ✅ `ClientsSyncPanel` usa `credentials: "include"` (correto)
- ✅ `ClientTable` não faz fetch (recebe dados via props)
- ✅ Página principal usa acesso direto ao banco

## Checklist de Validação

1. **Verificar código atual:**
   ```bash
   grep -r "fetch.*\/api\/clients" src/app/clients/page.tsx
   # Deve retornar vazio (não deve haver fetch)
   ```

2. **Aplicar migrações no banco de produção:**
   ```bash
   export DATABASE_URL="postgresql://...produção..."
   npm run db:migrate
   ```

3. **Fazer redeploy limpo na Vercel:**
   - Vercel Dashboard → Deployments → Redeploy
   - Marcar "Clear Build Cache"

4. **Validar após deploy:**
   ```bash
   # Testar endpoint diretamente (deve retornar 401 sem cookie)
   curl https://vulpetax.vercel.app/api/clients
   # Esperado: {"error":"Não autenticado"}

   # Testar após login no browser
   # Esperado: /clients carrega sem loop
   ```

## Se o Problema Persistir

### Debug Adicional

1. **Verificar logs da Vercel:**
   - Vercel Dashboard → Deployments → [último deploy] → Functions → `/api/clients`
   - Verificar se há erros de autenticação

2. **Verificar cookie de sessão:**
   - Browser DevTools → Application → Cookies
   - Verificar se `vulpeinc_session` existe após login
   - Verificar atributos: `HttpOnly`, `Secure`, `SameSite`

3. **Testar endpoint de debug:**
   ```bash
   curl https://vulpetax.vercel.app/api/debug/auth
   # Deve retornar informações sobre sessão
   ```

### Possível Fix Adicional

Se o problema persistir, pode ser necessário garantir que o middleware está funcionando corretamente. Verificar:

- `src/middleware.ts` está protegendo `/api/clients` corretamente
- `src/lib/passcodeSession.ts` está validando cookies corretamente
- Variáveis de ambiente na Vercel (`PASSCODE`, `PASSCODE_CURRENT`) estão configuradas

## Próximos Passos

1. ✅ Aplicar migrações no banco de produção
2. ✅ Fazer redeploy limpo na Vercel
3. ✅ Testar `/clients` após login
4. ✅ Verificar logs da Vercel para confirmar que não há mais 401
