import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

// --- RBAC & Audit (controle interno) ---

export const userRoles = ["admin", "preparer", "reviewer"] as const;
export type UserRole = (typeof userRoles)[number];

/**
 * Usuários da equipe (acesso interno).
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(), // admin | preparer | reviewer
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Audit log: quem alterou o quê, quando (antes/depois).
 */
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  entityType: text("entity_type").notNull(), // clients | llcs | tax_filings | reportable_transactions | related_parties
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // create | update | delete
  oldValues: text("old_values"), // JSON
  newValues: text("new_values"), // JSON
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Anexos: EIN letter, Articles, Operating Agreement, extratos, comprovantes.
 */
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  createdBy: text("created_by").references(() => users.id),
});

// --- Core entities ---

/**
 * Titular (não residente) da LLC - dono estrangeiro.
 * Pode ter múltiplas LLCs.
 */
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  country: text("country").notNull(),
  /** País de cidadania (formulário VulpeTax) */
  citizenshipCountry: text("citizenship_country"),
  /** Endereço particular (formulário) */
  address: text("address"),
  /** Endereço particular diferente do endereço da empresa? (formulário) */
  addressDifferentFromLLC: integer("address_different_from_llc", { mode: "boolean" }),
  /** Identificação fiscal EUA (ITIN/SSN), se aplicável */
  usTin: text("us_tin"),
  /** Número de identificação fiscal no país de residência (ex: CPF) */
  foreignTin: text("foreign_tin"),
  idType: text("id_type"),
  idNumber: text("id_number"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * LLC dos EUA (single-member, disregarded entity).
 * Uma LLC pertence a um cliente.
 */
export const llcs = sqliteTable("llcs", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ein: text("ein").notNull(),
  state: text("state").notNull(), // WY, DE, NM, FL, TX
  formationDate: integer("formation_date", { mode: "timestamp" }).notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  stateAddress: text("state_address"), // estado para endereço (2 chars)
  zip: text("zip"),
  /** Principal business activity code/desc (Form 1120) */
  businessActivity: text("business_activity"),
  /** Custo de constituição da LLC (USD) — formulário VulpeTax */
  formationCostUsd: real("formation_cost_usd"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Uma declaração fiscal por ano por LLC (Form 5472 + pro forma 1120).
 */
export const taxFilings = sqliteTable("tax_filings", {
  id: text("id").primaryKey(),
  llcId: text("llc_id")
    .notNull()
    .references(() => llcs.id, { onDelete: "cascade" }),
  taxYear: integer("tax_year").notNull(), // ex: 2024
  status: text("status").notNull(), // draft | ready_to_file | filed | extension
  federalDeadline: integer("federal_deadline", { mode: "timestamp" }),
  stateDeadline: integer("state_deadline", { mode: "timestamp" }),
  filedAt: integer("filed_at", { mode: "timestamp" }),
  /** Ativos totais da empresa até 31/12 (USD) — formulário VulpeTax */
  totalAssetsYearEndUsd: real("total_assets_year_end_usd"),
  /** Possui contas bancárias nos EUA em nome da LLC? */
  hasUsBankAccounts: integer("has_us_bank_accounts", { mode: "boolean" }),
  /** Saldo agregado superior a USD 10.000 no ano? (FBAR) */
  aggregateBalanceOver10k: integer("aggregate_balance_over_10k", { mode: "boolean" }),
  /** Declaração final aceita (li e compreendi) */
  declarationAcceptedAt: integer("declaration_accepted_at", { mode: "timestamp" }),
  declarationAcceptedBy: text("declaration_accepted_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Prazos por declaração: federal 1120/5472, state annual report, etc.
 */
export const deadlineTypes = [
  "federal_1120_5472",
  "state_annual_report",
] as const;
export type DeadlineType = (typeof deadlineTypes)[number];

export const deadlines = sqliteTable("deadlines", {
  id: text("id").primaryKey(),
  taxFilingId: text("tax_filing_id")
    .notNull()
    .references(() => taxFilings.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  isExtended: integer("is_extended", { mode: "boolean" }).default(false),
  extendedTo: integer("extended_to", { mode: "timestamp" }),
  status: text("status").notNull(), // pending | met | missed
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * “Entrega” física/efetiva: envio ao IRS/estado (tracking, comprovante).
 */
export const filingDeliveryMethods = ["paper_mail", "fax", "efile", "other"] as const;
export type FilingDeliveryMethod = (typeof filingDeliveryMethods)[number];

export const filingDeliveries = sqliteTable("filing_deliveries", {
  id: text("id").primaryKey(),
  taxFilingId: text("tax_filing_id")
    .notNull()
    .references(() => taxFilings.id, { onDelete: "cascade" }),
  filingMethod: text("filing_method").notNull(),
  shippingTracking: text("shipping_tracking"),
  faxConfirmation: text("fax_confirmation"),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  deliveredAt: integer("delivered_at", { mode: "timestamp" }),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Related parties (foreign related party e outros) por declaração.
 * Mínimo 1 por tax_filing; múltiplos = múltiplos 5472/linhas.
 */
export const relatedParties = sqliteTable("related_parties", {
  id: text("id").primaryKey(),
  taxFilingId: text("tax_filing_id")
    .notNull()
    .references(() => taxFilings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Tipo: owner (titular), owner_company, other */
  partyType: text("party_type").notNull(),
  address: text("address"),
  country: text("country").notNull(),
  tin: text("tin"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Tipos de transação reportáveis no Form 5472 (Part IV).
 * Cada transação é entre a LLC e o titular estrangeiro (related party).
 */
export const reportableTransactionTypes = [
  "contribution",
  "distribution",
  "loan_from_owner",
  "loan_to_owner",
  "payment_for_services",
  "sale_of_inventory",
  "sale_of_tangible_property",
  "personal_expenses_paid_by_llc",   // Despesas pessoais pagas com recursos da empresa
  "business_expenses_paid_personally", // Despesas empresariais pagas com recursos pessoais
  "other",
] as const;

export type ReportableTransactionType =
  (typeof reportableTransactionTypes)[number];

export const documentationStatuses = ["pending", "ok"] as const;
export type DocumentationStatus = (typeof documentationStatuses)[number];

/**
 * Transações reportáveis para o Form 5472 no ano fiscal.
 * Pode ter related_party_id (obrigatório quando houver related parties cadastrados).
 */
export const reportableTransactions = sqliteTable("reportable_transactions", {
  id: text("id").primaryKey(),
  taxFilingId: text("tax_filing_id")
    .notNull()
    .references(() => taxFilings.id, { onDelete: "cascade" }),
  relatedPartyId: text("related_party_id").references(() => relatedParties.id, {
    onDelete: "set null",
  }),
  transactionType: text("transaction_type").notNull(),
  description: text("description"),
  amountUsd: real("amount_usd").notNull(),
  amountOriginal: real("amount_original"),
  currency: text("currency"),
  fxRate: real("fx_rate"),
  fxSource: text("fx_source"),
  transactionDate: integer("transaction_date", { mode: "timestamp" }),
  documentationStatus: text("documentation_status").default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type Deadline = typeof deadlines.$inferSelect;
export type NewDeadline = typeof deadlines.$inferInsert;
export type FilingDelivery = typeof filingDeliveries.$inferSelect;
export type NewFilingDelivery = typeof filingDeliveries.$inferInsert;
export type RelatedParty = typeof relatedParties.$inferSelect;
export type NewRelatedParty = typeof relatedParties.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type LLC = typeof llcs.$inferSelect;
export type NewLLC = typeof llcs.$inferInsert;
export type TaxFiling = typeof taxFilings.$inferSelect;
export type NewTaxFiling = typeof taxFilings.$inferInsert;
export type ReportableTransaction = typeof reportableTransactions.$inferSelect;
export type NewReportableTransaction = typeof reportableTransactions.$inferInsert;
