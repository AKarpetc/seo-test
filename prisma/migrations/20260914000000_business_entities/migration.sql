
-- CreateTable
CREATE TABLE "BusinessEntity" (
    "id" SERIAL NOT NULL,
    "entityKey" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT,
    "status" TEXT,
    "filingDate" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT,
    "zip" TEXT,
    "county" TEXT,
    "agentName" TEXT,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessEntity_entityKey_key" ON "BusinessEntity"("entityKey");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessEntity_slug_key" ON "BusinessEntity"("slug");

-- CreateIndex
CREATE INDEX "BusinessEntity_state_filingDate_idx" ON "BusinessEntity"("state", "filingDate");

-- CreateIndex
CREATE INDEX "BusinessEntity_filingDate_idx" ON "BusinessEntity"("filingDate");

-- CreateIndex
CREATE INDEX "BusinessEntity_state_city_idx" ON "BusinessEntity"("state", "city");

-- CreateIndex
CREATE INDEX "BusinessEntity_name_idx" ON "BusinessEntity"("name");

