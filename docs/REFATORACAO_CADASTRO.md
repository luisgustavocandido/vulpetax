# Refatoração: Cadastro Pós Venda LLC

## Visão geral

O cadastro de "cliente" foi reformulado para **Pós Venda LLC**, com três seções principais: EMPRESA, ITENS e SÓCIOS.

## Schema

### clients (Pós Venda LLC)
| Campo        | Tipo    | Obrigatório | Descrição                              |
|-------------|---------|-------------|----------------------------------------|
| id          | uuid    | sim         | PK                                     |
| companyName | varchar(255) | sim    | Empresa                                |
| customerCode| varchar(100) | sim, único | Código do cliente / Registro       |
| paymentDate | date    | não         | Data de Pagamento                      |
| commercial  | enum    | não         | João, Pablo, Gabriel, Gustavo          |
| sdr         | enum    | não         | João, Pablo, Gabriel, Gustavo          |
| businessType| varchar(255) | não   | Tipo de Negócio                        |
| paymentMethod | varchar(100) | não  | Pagamento via (Stripe, PIX, etc.)     |
| anonymous   | boolean | não, default false | Anônimo                       |
| holding     | boolean | não, default false | Holding                      |
| affiliate   | boolean | não, default false | Afiliado                      |
| express     | boolean | não, default false | Express                      |
| notes       | text    | não         | Observações                            |
| createdAt, updatedAt, deletedAt | timestamp | - | Técnicos                |

### client_line_items
| Campo      | Tipo   | Descrição                         |
|------------|--------|-----------------------------------|
| id         | uuid   | PK                                |
| clientId   | uuid   | FK → clients                      |
| kind       | enum   | LLC, Endereco, Mensalidade, Gateway, ServicoAdicional, BancoTradicional, Outro |
| description| text   | Descrição do item                 |
| valueCents | int    | Valor em centavos                 |
| meta       | jsonb  | Detalhes extras (opcional)        |

### client_partners
| Campo               | Tipo | Descrição                          |
|---------------------|------|------------------------------------|
| id                  | uuid | PK                                 |
| clientId            | uuid | FK → clients                       |
| fullName            | text | Nome do sócio                      |
| role                | enum | SocioPrincipal, Socio              |
| percentageBasisPoints | int | 0-10000 (10000 = 100%)          |
| phone               | varchar(50) | Telefone (opcional)          |

## Dinheiro (centavos)

Valores são armazenados como **inteiro em centavos** (`valueCents`). Ex.: R$ 150,50 = 15050.

- UI: exibir em reais (dividir por 100)
- API: enviar e receber em centavos

## Estratégia replace-all (itens e sócios)

No PATCH, itens e sócios são substituídos por completo:

1. Apagar todos os itens do cliente
2. Inserir os novos itens enviados
3. Apagar todos os sócios do cliente
4. Inserir os novos sócios enviados

Tudo em transação única.

## Payloads

### POST /api/clients (criar)

```json
{
  "companyName": "Empresa XYZ",
  "customerCode": "REG-001",
  "paymentDate": "2025-02-10",
  "commercial": "João",
  "sdr": "Pablo",
  "businessType": "LLC",
  "paymentMethod": "Stripe",
  "anonymous": false,
  "holding": false,
  "affiliate": false,
  "express": false,
  "notes": "Cliente prioritário",
  "items": [
    {
      "kind": "LLC",
      "description": "Estado e Plano FL - Anual",
      "valueCents": 50000,
      "meta": { "estado": "FL", "plano": "Anual" }
    }
  ],
  "partners": [
    {
      "fullName": "Maria Silva",
      "role": "SocioPrincipal",
      "percentage": 60.5,
      "phone": "11999999999"
    }
  ]
}
```

### PATCH /api/clients/[id] (atualizar)

Mesma estrutura do POST, todos os campos opcionais. Envie `items` e/ou `partners` para substituir totalmente as listas.

## Busca e filtros

- GET /api/clients?q=termo: busca em `companyName`, `customerCode` e `paymentMethod`
- Paginação: `page`, `limit`

## Importação

A importação CSV/XLSX foi **desabilitada** após a refatoração. O endpoint POST /api/clients/import retorna 501.
