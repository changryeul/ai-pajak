-- CreateTable
CREATE TABLE "Document" (
    "id" BIGSERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ocrJobId" TEXT,
    "taxCaseId" BIGINT,
    "uploadedBy" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_taxCaseId_idx" ON "Document"("taxCaseId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
