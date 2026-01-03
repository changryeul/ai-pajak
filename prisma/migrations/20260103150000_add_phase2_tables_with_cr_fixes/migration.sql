-- CreateEnum
CREATE TYPE "SubmissionPrepStatus" AS ENUM ('GENERATED', 'VALIDATED', 'READY_TO_FILE', 'MANUALLY_SUBMITTED', 'VALIDATION_FAILED');

-- CreateEnum
CREATE TYPE "EfakturStatus" AS ENUM ('GENERATED', 'DOWNLOADED', 'UPLOADED');

-- CreateEnum
CREATE TYPE "OcrEngine" AS ENUM ('PADDLEOCR', 'GEMINI', 'MANUAL');

-- AlterTable: Add Phase 2 OCR fields to AIResult
ALTER TABLE "AIResult" ADD COLUMN     "confidenceScore" DECIMAL(5,2),
ADD COLUMN     "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ocrEngine" "OcrEngine",
ADD COLUMN     "processingTimeMs" INTEGER;

-- CreateTable: SubmissionPrep
CREATE TABLE "SubmissionPrep" (
    "id" BIGSERIAL NOT NULL,
    "taxCaseId" BIGINT NOT NULL,
    "sptData" JSONB NOT NULL,
    "operatorHelperData" JSONB,
    "status" "SubmissionPrepStatus" NOT NULL DEFAULT 'GENERATED',
    "validatedAt" TIMESTAMP(3),
    "validationErrors" JSONB,
    "preparedByConsultantId" BIGINT,
    "manuallySubmittedAt" TIMESTAMP(3),
    "djpReferenceId" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionPrep_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BpeDocument
CREATE TABLE "BpeDocument" (
    "id" BIGSERIAL NOT NULL,
    "taxCaseId" BIGINT NOT NULL,
    "bpeNumber" VARCHAR(50),
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedByConsultantId" BIGINT,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "sentToCustomerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BpeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EfakturFile
CREATE TABLE "EfakturFile" (
    "id" BIGSERIAL NOT NULL,
    "taxCaseId" BIGINT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "EfakturStatus" NOT NULL DEFAULT 'GENERATED',
    "downloadedAt" TIMESTAMP(3),
    "manuallyUploadedAt" TIMESTAMP(3),
    "djpReferenceId" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EfakturFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BillingPrep
CREATE TABLE "BillingPrep" (
    "id" BIGSERIAL NOT NULL,
    "taxCaseId" BIGINT NOT NULL,
    "billingData" JSONB NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "ntpn" VARCHAR(50),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPrep_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PowerOfAttorney
CREATE TABLE "PowerOfAttorney" (
    "id" BIGSERIAL NOT NULL,
    "customerId" BIGINT NOT NULL,
    "companyId" BIGINT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PowerOfAttorney_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PoaValidationCache (with createdAt - Code Review Fix)
CREATE TABLE "PoaValidationCache" (
    "id" BIGSERIAL NOT NULL,
    "poaId" BIGINT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "expiryWarningSent" BOOLEAN NOT NULL DEFAULT false,
    "nextValidationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoaValidationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SubmissionPrep
CREATE UNIQUE INDEX "SubmissionPrep_taxCaseId_key" ON "SubmissionPrep"("taxCaseId");
CREATE INDEX "SubmissionPrep_taxCaseId_idx" ON "SubmissionPrep"("taxCaseId");
CREATE INDEX "SubmissionPrep_status_idx" ON "SubmissionPrep"("status");

-- CreateIndex: BpeDocument
CREATE UNIQUE INDEX "BpeDocument_bpeNumber_key" ON "BpeDocument"("bpeNumber");
CREATE INDEX "BpeDocument_taxCaseId_idx" ON "BpeDocument"("taxCaseId");

-- CreateIndex: EfakturFile
CREATE INDEX "EfakturFile_taxCaseId_idx" ON "EfakturFile"("taxCaseId");
CREATE INDEX "EfakturFile_status_idx" ON "EfakturFile"("status");

-- CreateIndex: BillingPrep
CREATE UNIQUE INDEX "BillingPrep_taxCaseId_key" ON "BillingPrep"("taxCaseId");
CREATE INDEX "BillingPrep_taxCaseId_idx" ON "BillingPrep"("taxCaseId");

-- CreateIndex: PowerOfAttorney (Code Review Fix: added customerId index)
CREATE INDEX "PowerOfAttorney_customerId_idx" ON "PowerOfAttorney"("customerId");
CREATE INDEX "PowerOfAttorney_companyId_idx" ON "PowerOfAttorney"("companyId");
CREATE INDEX "PowerOfAttorney_endDate_idx" ON "PowerOfAttorney"("endDate");

-- CreateIndex: PoaValidationCache
CREATE INDEX "PoaValidationCache_poaId_idx" ON "PoaValidationCache"("poaId");

-- CreateIndex: AIResult (new indexes)
CREATE INDEX "AIResult_taxCaseId_idx" ON "AIResult"("taxCaseId");
CREATE INDEX "AIResult_taxCaseId_ocrEngine_idx" ON "AIResult"("taxCaseId", "ocrEngine");

-- DropForeignKey: AIResult (to update onDelete policy)
ALTER TABLE "AIResult" DROP CONSTRAINT "AIResult_taxCaseId_fkey";

-- AddForeignKey: AIResult (Code Review Fix: onDelete Cascade)
ALTER TABLE "AIResult" ADD CONSTRAINT "AIResult_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SubmissionPrep (Code Review Fix: onDelete Cascade)
ALTER TABLE "SubmissionPrep" ADD CONSTRAINT "SubmissionPrep_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SubmissionPrep (Code Review Fix: onDelete SetNull)
ALTER TABLE "SubmissionPrep" ADD CONSTRAINT "SubmissionPrep_preparedByConsultantId_fkey" FOREIGN KEY ("preparedByConsultantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: BpeDocument (Code Review Fix: onDelete Cascade)
ALTER TABLE "BpeDocument" ADD CONSTRAINT "BpeDocument_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BpeDocument (Code Review Fix: onDelete SetNull)
ALTER TABLE "BpeDocument" ADD CONSTRAINT "BpeDocument_uploadedByConsultantId_fkey" FOREIGN KEY ("uploadedByConsultantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: EfakturFile (Code Review Fix: onDelete Cascade)
ALTER TABLE "EfakturFile" ADD CONSTRAINT "EfakturFile_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BillingPrep (Code Review Fix: onDelete Cascade)
ALTER TABLE "BillingPrep" ADD CONSTRAINT "BillingPrep_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PowerOfAttorney (Code Review Fix: customerId references User)
ALTER TABLE "PowerOfAttorney" ADD CONSTRAINT "PowerOfAttorney_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PowerOfAttorney
ALTER TABLE "PowerOfAttorney" ADD CONSTRAINT "PowerOfAttorney_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PoaValidationCache (Code Review Fix: onDelete Cascade)
ALTER TABLE "PoaValidationCache" ADD CONSTRAINT "PoaValidationCache_poaId_fkey" FOREIGN KEY ("poaId") REFERENCES "PowerOfAttorney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
