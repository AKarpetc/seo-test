
-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "modelYear" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "recallCount" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleRecall" (
    "id" SERIAL NOT NULL,
    "campaignNumber" TEXT NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "component" TEXT,
    "summary" TEXT,
    "consequence" TEXT,
    "remedy" TEXT,
    "notes" TEXT,
    "manufacturer" TEXT,
    "reportDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleRecall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_slug_key" ON "Vehicle"("slug");

-- CreateIndex
CREATE INDEX "Vehicle_make_model_idx" ON "Vehicle"("make", "model");

-- CreateIndex
CREATE INDEX "Vehicle_modelYear_idx" ON "Vehicle"("modelYear");

-- CreateIndex
CREATE INDEX "Vehicle_recallCount_idx" ON "Vehicle"("recallCount");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_modelYear_make_model_key" ON "Vehicle"("modelYear", "make", "model");

-- CreateIndex
CREATE INDEX "VehicleRecall_vehicleId_idx" ON "VehicleRecall"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRecall_campaignNumber_vehicleId_key" ON "VehicleRecall"("campaignNumber", "vehicleId");

-- AddForeignKey
ALTER TABLE "VehicleRecall" ADD CONSTRAINT "VehicleRecall_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

