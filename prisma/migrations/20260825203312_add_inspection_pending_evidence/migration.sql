-- AlterTable
ALTER TABLE "inspections" ADD COLUMN     "evidence_completed_at" TIMESTAMP(3),
ADD COLUMN     "pending_evidence" JSONB;
