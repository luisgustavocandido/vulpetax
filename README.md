# VulpeTax

Automação de coleta de dados e gestão de declarações fiscais (Form 5472 + pro forma Form 1120) para LLCs dos EUA de não residentes. Projeto Vulpeinc.

**Uso atual:** ferramenta de **controle interno** apenas (equipe Vulpeinc). Não é produto público nem portal do cliente.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS**
- **Drizzle ORM** + SQLite (arquivo local `vulpetax.db`)

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Criar/atualizar tabelas no banco
npm run db:push

# Rodar em desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

**Controle interno:** em [/login](http://localhost:3000/login) escolha um usuário (criado pelo seed) para que as ações sejam registradas no [audit log](/audit).

### Seed (dados de teste)

Em desenvolvimento, você pode popular o banco com um cliente, LLC e declaração de exemplo:

```bash
curl -X POST http://localhost:3000/seed
```

## Fluxo da aplicação

1. **Clientes** — Cadastro do titular (não residente): nome, e-mail, país, CPF/TIN, etc.
2. **LLCs** — Por cliente: nome da LLC, EIN, estado (WY, DE, NM, FL, TX), data de formação, endereço.
3. **Declarações** — Por LLC, por ano fiscal: status (rascunho / pronto / enviado), prazos federal e estadual.
4. **Transações reportáveis (Form 5472)** — Por declaração: tipo (contribuição, distribuição, empréstimo, pagamento por serviços, etc.) e valor em USD.

## Scripts

| Comando        | Descrição                    |
|----------------|------------------------------|
| `npm run dev`  | Servidor de desenvolvimento  |
| `npm run build`| Build de produção            |
| `npm run start`| Servidor de produção         |
| `npm run db:push`   | Sincroniza schema com o SQLite |
| `npm run db:generate` | Gera migrations (Drizzle)  |
| `npm run db:studio`  | Abre Drizzle Studio (UI do banco) |

## Deploy (Railway)

Veja [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md) para instruções de deploy no Railway com SQLite persistente.

## Próximos passos (sugestões)

- Integração com fluxo Vulpeinc (clientes vindos da formação de LLC).
- Geração de PDF/XML do Form 5472 e pro forma 1120 a partir dos dados.
- E-filing (envio ao IRS) via parceiro ou API.
- Lembretes por e-mail (prazos federal e estado).
- Autenticação para equipe Vulpeinc e/ou portal do cliente.
