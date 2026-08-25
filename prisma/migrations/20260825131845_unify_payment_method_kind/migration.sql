-- Unifica "Cuenta" (own/third_party) y el subtipo "Tipo de cuenta ajena"
-- (ThirdPartyKind: employee/provider) en un solo campo de 3 valores:
-- own / associate / provider. "employee" pasa a llamarse "associate".
--
-- Ningún medio de pago tenía ownership='third_party' todavía (la
-- reclasificación nunca se desplegó), pero el mapeo de datos queda igual
-- por las dudas: third_party + kind=provider -> provider; cualquier otro
-- third_party (kind=employee o sin clasificar) -> associate.
BEGIN;

CREATE TYPE "PaymentMethodOwnership_new" AS ENUM ('own', 'associate', 'provider');

ALTER TABLE "payment_methods" ALTER COLUMN "ownership" DROP DEFAULT;
ALTER TABLE "payment_methods" ALTER COLUMN "ownership" TYPE "PaymentMethodOwnership_new" USING (
  CASE
    WHEN "ownership"::text = 'third_party' AND "third_party_kind"::text = 'provider' THEN 'provider'
    WHEN "ownership"::text = 'third_party' THEN 'associate'
    ELSE "ownership"::text
  END::"PaymentMethodOwnership_new"
);
ALTER TABLE "payment_methods" ALTER COLUMN "ownership" SET DEFAULT 'own';

ALTER TYPE "PaymentMethodOwnership" RENAME TO "PaymentMethodOwnership_old";
ALTER TYPE "PaymentMethodOwnership_new" RENAME TO "PaymentMethodOwnership";
DROP TYPE "PaymentMethodOwnership_old";

ALTER TABLE "payment_methods" DROP COLUMN "third_party_kind";
DROP TYPE "ThirdPartyKind";

COMMIT;
