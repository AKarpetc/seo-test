-- AlterTable
ALTER TABLE "DOTCarrier" ADD COLUMN     "authorityDate" TIMESTAMP(3),
ADD COLUMN     "mcs150Date" TIMESTAMP(3);


-- CreateIndex
CREATE INDEX "DOTCarrier_authorityDate_idx" ON "DOTCarrier"("authorityDate");

