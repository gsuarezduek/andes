-- AlterTable
ALTER TABLE "email_settings" ADD COLUMN     "monthly_report_roles" "UserRole"[] DEFAULT ARRAY['observador']::"UserRole"[],
ADD COLUMN     "monthly_report_to_owner" BOOLEAN NOT NULL DEFAULT true;
