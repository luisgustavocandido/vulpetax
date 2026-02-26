-- Cadastro explícito de pessoa (person group); id = personGroupId referenciado em clients
CREATE TABLE IF NOT EXISTS "person_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "given_name" text NOT NULL,
  "sur_name" text NOT NULL,
  "citizenship_country" text NOT NULL,
  "phone" text,
  "email" text,
  "address_line1" text,
  "address_line2" text,
  "city" text,
  "state_province" text,
  "postal_code" text,
  "country" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
