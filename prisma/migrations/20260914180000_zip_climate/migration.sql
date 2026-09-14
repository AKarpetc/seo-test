
-- CreateTable
CREATE TABLE "ZipClimate" (
    "id" SERIAL NOT NULL,
    "zip" TEXT NOT NULL,
    "zone" TEXT,
    "zoneTempRange" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "city" TEXT,
    "state" TEXT,
    "county" TEXT,
    "population" INTEGER,
    "stationId" TEXT,
    "stationMiles" DOUBLE PRECISION,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZipClimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZipClimate_zip_key" ON "ZipClimate"("zip");

-- CreateIndex
CREATE UNIQUE INDEX "ZipClimate_slug_key" ON "ZipClimate"("slug");

-- CreateIndex
CREATE INDEX "ZipClimate_zone_idx" ON "ZipClimate"("zone");

-- CreateIndex
CREATE INDEX "ZipClimate_state_city_idx" ON "ZipClimate"("state", "city");

-- CreateIndex
CREATE INDEX "ZipClimate_stationId_idx" ON "ZipClimate"("stationId");

