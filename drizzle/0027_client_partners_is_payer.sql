-- Marca o sócio que é o cliente pagador (quem realizou o pagamento)
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS is_payer boolean NOT NULL DEFAULT false;
