import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, type PartnerRole } from "@/db/schema";
import { percentToBasisPoints } from "@/lib/clientSchemas";
import { findOrCreateCustomer } from "@/lib/customers/repo";
import type { CreateCustomerInput } from "@/lib/customers/validators";

export type PartnerPayload = {
  fullName: string;
  role: string;
  percentage: number;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isPayer?: boolean;
  customerId?: string | null;
  customerInline?: {
    fullName: string;
    givenName: string;
    surName: string;
    citizenshipCountry: string;
    phone?: string | null;
    email: string;
    address: {
      line1: string;
      line2?: string | null;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
    };
  } | null;
};

export type ResolvedPartnerRow = {
  fullName: string;
  role: PartnerRole;
  percentageBasisPoints: number;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isPayer: boolean;
  customerId: string | null;
  /** true quando o customer foi reutilizado por email (não criado novo). */
  customerReused?: boolean;
};

/**
 * Resolve partner payload to row values (incl. customerId).
 * When customerInline: creates customer in tx and sets customerId.
 * When customerId: loads customer and uses its data for partner row.
 */
/** Aceita db ou o client de db.transaction(); na chamada use (tx as typeof db) se necessário. */
export async function resolvePartnerForInsert(
  tx: typeof db,
  p: PartnerPayload
): Promise<ResolvedPartnerRow> {
  const isPayer = p.isPayer ?? false;
  if (isPayer && p.customerInline) {
    const input: CreateCustomerInput = {
      fullName: p.customerInline.fullName,
      givenName: p.customerInline.givenName,
      surName: p.customerInline.surName,
      citizenshipCountry: p.customerInline.citizenshipCountry,
      phone: p.customerInline.phone ?? null,
      email: p.customerInline.email,
      address: p.customerInline.address,
    };
    const { id: customerId, reused } = await findOrCreateCustomer(tx, input);
    const [cust] = await tx
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (!cust) throw new Error("customer not found after findOrCreate");
    return {
      fullName: cust.fullName,
      role: p.role as PartnerRole,
      percentageBasisPoints: percentToBasisPoints(p.percentage),
      phone: cust.phone,
      email: cust.email,
      addressLine1: cust.addressLine1,
      addressLine2: cust.addressLine2,
      city: cust.city,
      state: cust.stateProvince,
      postalCode: cust.postalCode,
      country: cust.country,
      isPayer: true,
      customerId: cust.id,
      customerReused: reused,
    };
  }
  if (isPayer && p.customerId) {
    const [cust] = await tx
      .select()
      .from(customers)
      .where(eq(customers.id, p.customerId))
      .limit(1);
    if (!cust) {
      const err = new Error("CUSTOMER_NOT_FOUND") as Error & { code?: string };
      err.code = "CUSTOMER_NOT_FOUND";
      throw err;
    }
    return {
      fullName: cust.fullName,
      role: p.role as PartnerRole,
      percentageBasisPoints: percentToBasisPoints(p.percentage),
      phone: cust.phone,
      email: cust.email,
      addressLine1: cust.addressLine1,
      addressLine2: cust.addressLine2,
      city: cust.city,
      state: cust.stateProvince,
      postalCode: cust.postalCode,
      country: cust.country,
      isPayer: true,
      customerId: cust.id,
    };
  }
  return {
    fullName: p.fullName,
    role: p.role as PartnerRole,
    percentageBasisPoints: percentToBasisPoints(p.percentage),
    phone: p.phone ?? null,
    email: p.email?.trim() || null,
    addressLine1: p.addressLine1?.trim() || null,
    addressLine2: p.addressLine2?.trim() || null,
    city: p.city?.trim() || null,
    state: p.state?.trim() || null,
    postalCode: p.postalCode?.trim() || null,
    country: p.country?.trim() || null,
    isPayer,
    customerId: null,
  };
}
