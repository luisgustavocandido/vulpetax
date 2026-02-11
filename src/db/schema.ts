import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  date,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// --- Enums ---
export const COMMERCIAL_SDR_VALUES = ["João", "Pablo", "Gabriel", "Gustavo"] as const;
export type CommercialSdr = (typeof COMMERCIAL_SDR_VALUES)[number];

export const LINE_ITEM_KINDS = [
  "LLC",
  "Endereco",
  "Mensalidade",
  "Gateway",
  "ServicoAdicional",
  "BancoTradicional",
  "Outro",
] as const;
export type LineItemKind = (typeof LINE_ITEM_KINDS)[number];

export const PARTNER_ROLES = ["SocioPrincipal", "Socio"] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];

// --- users ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 20 })
    .notNull()
    .default("user")
    .$type<"admin" | "user" | "viewer">(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- clients (Pós Venda LLC) ---
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    companyNameNormalized: varchar("company_name_normalized", { length: 255 }).notNull(),
    customerCode: varchar("customer_code", { length: 100 }).notNull().unique(),
  paymentDate: date("payment_date"),
  commercial: varchar("commercial", { length: 50 }).$type<CommercialSdr>(),
  sdr: varchar("sdr", { length: 50 }).$type<CommercialSdr>(),
  businessType: varchar("business_type", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 100 }),
  anonymous: boolean("anonymous").notNull().default(false),
  holding: boolean("holding").notNull().default(false),
  affiliate: boolean("affiliate").notNull().default(false),
  express: boolean("express").notNull().default(false),
  notes: text("notes"),
  taxFormSource: varchar("tax_form_source", { length: 50 }),
  taxFormSubmittedAt: timestamp("tax_form_submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("clients_company_name_normalized_idx")
      .on(table.companyNameNormalized)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_clients_tax_form_source")
      .on(table.taxFormSource)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

export type ClientInsert = typeof clients.$inferInsert;

// --- client_line_items ---
export const clientLineItems = pgTable(
  "client_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 50 })
      .notNull()
      .$type<LineItemKind>(),
    description: text("description").notNull(),
    valueCents: integer("value_cents").notNull().default(0),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

// --- client_partners ---
// percentage: integer basis points (10000 = 100.00%)
export const clientPartners = pgTable("client_partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  role: varchar("role", { length: 30 })
    .notNull()
    .$type<PartnerRole>(),
  percentageBasisPoints: integer("percentage_basis_points").notNull(), // 10000 = 100%
  phone: varchar("phone", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- audit_log ---
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 10 })
    .notNull()
    .$type<"create" | "update" | "delete">(),
  entity: varchar("entity", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  actor: varchar("actor", { length: 100 }),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- sync_state ---
export const syncState = pgTable("sync_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastRunStatus: varchar("last_run_status", { length: 20 }),
  lastRunError: text("last_run_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- import_history ---
export const importHistory = pgTable("import_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  filename: varchar("filename", { length: 255 }).notNull(),
  rowsTotal: integer("rows_total").notNull(),
  rowsImported: integer("rows_imported").notNull().default(0),
  rowsErrors: integer("rows_errors").notNull().default(0),
  errorsJson: jsonb("errors_json"),
  actor: varchar("actor", { length: 100 }),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- TAX (Não Residentes) - Formulário Form 5472 + 1120 ---

export const clientTaxProfile = pgTable("client_tax_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" })
    .unique(),
  llcName: text("llc_name"),
  formationDate: date("formation_date"),
  activitiesDescription: text("activities_description"),
  einNumber: text("ein_number"),
  llcUsAddressLine1: text("llc_us_address_line1"),
  llcUsAddressLine2: text("llc_us_address_line2"),
  llcUsCity: text("llc_us_city"),
  llcUsState: text("llc_us_state"),
  llcUsZip: text("llc_us_zip"),
  ownerEmail: text("owner_email"),
  ownerFullLegalName: text("owner_full_legal_name"),
  ownerResidenceCountry: text("owner_residence_country"),
  ownerCitizenshipCountry: text("owner_citizenship_country"),
  ownerHomeAddressDifferent: boolean("owner_home_address_different").default(false),
  ownerUsTaxId: text("owner_us_tax_id"),
  ownerForeignTaxId: text("owner_foreign_tax_id"),
  llcFormationCostUsdCents: integer("llc_formation_cost_usd_cents"),
  hasAdditionalOwners: boolean("has_additional_owners").default(false),
  totalAssetsUsdCents: integer("total_assets_usd_cents"),
  hasUsBankAccounts: boolean("has_us_bank_accounts").default(false),
  aggregateBalanceOver10k: boolean("aggregate_balance_over10k").default(false),
  totalWithdrawalsUsdCents: integer("total_withdrawals_usd_cents"),
  totalTransferredToLlcUsdCents: integer("total_transferred_to_llc_usd_cents"),
  totalWithdrawnFromLlcUsdCents: integer("total_withdrawn_from_llc_usd_cents"),
  personalExpensesPaidByCompanyUsdCents: integer("personal_expenses_paid_by_company_usd_cents"),
  businessExpensesPaidPersonallyUsdCents: integer("business_expenses_paid_personally_usd_cents"),
  passportCopiesProvided: boolean("passport_copies_provided").default(false),
  articlesOfOrganizationProvided: boolean("articles_of_organization_provided").default(false),
  einLetterProvided: boolean("ein_letter_provided").default(false),
  additionalDocumentsProvided: boolean("additional_documents_provided").default(false),
  additionalDocumentsNotes: text("additional_documents_notes"),
  declarationAccepted: boolean("declaration_accepted").default(false),
  declarationAcceptedAt: timestamp("declaration_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientTaxOwners = pgTable(
  "client_tax_owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    ownerIndex: integer("owner_index").notNull(),
    email: text("email"),
    fullLegalName: text("full_legal_name"),
    residenceCountry: text("residence_country"),
    citizenshipCountry: text("citizenship_country"),
    homeAddressDifferent: boolean("home_address_different").default(false),
    usTaxId: text("us_tax_id"),
    foreignTaxId: text("foreign_tax_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("client_tax_owners_client_id_idx").on(table.clientId),
    unique("client_tax_owners_client_owner_unique").on(table.clientId, table.ownerIndex),
  ]
);

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
  clientsCreated: many(clients, { relationName: "createdBy" }),
  clientsUpdated: many(clients, { relationName: "updatedBy" }),
  auditLogs: many(auditLog),
  importHistories: many(importHistory),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  createdByUser: one(users, {
    relationName: "createdBy",
    fields: [clients.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    relationName: "updatedBy",
    fields: [clients.updatedBy],
    references: [users.id],
  }),
  lineItems: many(clientLineItems),
  partners: many(clientPartners),
  taxProfile: one(clientTaxProfile),
  taxOwners: many(clientTaxOwners),
}));

export const clientLineItemsRelations = relations(clientLineItems, ({ one }) => ({
  client: one(clients, {
    fields: [clientLineItems.clientId],
    references: [clients.id],
  }),
}));

export const clientPartnersRelations = relations(clientPartners, ({ one }) => ({
  client: one(clients, {
    fields: [clientPartners.clientId],
    references: [clients.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

export const importHistoryRelations = relations(importHistory, ({ one }) => ({
  user: one(users, {
    fields: [importHistory.userId],
    references: [users.id],
  }),
}));

export const clientTaxProfileRelations = relations(clientTaxProfile, ({ one }) => ({
  client: one(clients, {
    fields: [clientTaxProfile.clientId],
    references: [clients.id],
  }),
}));

export const clientTaxOwnersRelations = relations(clientTaxOwners, ({ one }) => ({
  client: one(clients, {
    fields: [clientTaxOwners.clientId],
    references: [clients.id],
  }),
}));
