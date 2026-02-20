-- Backfill: due_date = period_end para cobranças pending/overdue (vencimento = data de expiração do período)
UPDATE billing_charges
SET due_date = period_end, updated_at = NOW()
WHERE status IN ('pending', 'overdue')
  AND (due_date IS DISTINCT FROM period_end);

-- Corrige status: overdue com due_date >= hoje volta para pending (ex.: após o UPDATE acima)
UPDATE billing_charges
SET status = 'pending', updated_at = NOW()
WHERE status = 'overdue'
  AND due_date >= CURRENT_DATE;
