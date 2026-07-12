-- CreateTable
CREATE TABLE "email_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "from_address" TEXT,
    "es_handover_subject" TEXT,
    "es_return_subject" TEXT,
    "es_greeting" TEXT,
    "es_handover_body" TEXT,
    "es_return_body" TEXT,
    "es_attachment_note" TEXT,
    "es_regards" TEXT,
    "en_handover_subject" TEXT,
    "en_return_subject" TEXT,
    "en_greeting" TEXT,
    "en_handover_body" TEXT,
    "en_return_body" TEXT,
    "en_attachment_note" TEXT,
    "en_regards" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);
