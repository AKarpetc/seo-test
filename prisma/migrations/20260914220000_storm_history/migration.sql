-- DropIndex
DROP INDEX "ZipClimate_snowStationId_idx";

-- DropTable
DROP TABLE "BankBranch_legacy_20260913";

-- CreateTable
CREATE TABLE "Storm" (
    "id" SERIAL NOT NULL,
    "stormId" TEXT NOT NULL,
    "basin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "maxWind" INTEGER,
    "category" INTEGER,
    "firstDate" TIMESTAMP(3),
    "lastDate" TIMESTAMP(3),
    "cityCount" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Storm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StormPoint" (
    "id" SERIAL NOT NULL,
    "stormId" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "wind" INTEGER,
    "status" TEXT NOT NULL,

    CONSTRAINT "StormPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tornado" (
    "id" SERIAL NOT NULL,
    "spcKey" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL,
    "mag" INTEGER,
    "injuries" INTEGER NOT NULL DEFAULT 0,
    "fatalities" INTEGER NOT NULL DEFAULT 0,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "endLat" DOUBLE PRECISION,
    "endLng" DOUBLE PRECISION,
    "lengthMiles" DOUBLE PRECISION,
    "widthYards" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tornado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StormCity" (
    "id" SERIAL NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "population" INTEGER,
    "hurricaneCount" INTEGER NOT NULL DEFAULT 0,
    "tropicalStormCount" INTEGER NOT NULL DEFAULT 0,
    "lastStormYear" INTEGER,
    "lastStormName" TEXT,
    "strongestCategory" INTEGER,
    "strongestStormName" TEXT,
    "tornadoCount" INTEGER NOT NULL DEFAULT 0,
    "strongTornadoCount" INTEGER NOT NULL DEFAULT 0,
    "tornadoFatalities" INTEGER NOT NULL DEFAULT 0,
    "lastTornadoYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StormCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityStorm" (
    "id" SERIAL NOT NULL,
    "cityId" INTEGER NOT NULL,
    "stormId" INTEGER NOT NULL,
    "closestMiles" DOUBLE PRECISION NOT NULL,
    "windAtClosest" INTEGER,
    "statusAtClosest" TEXT,
    "closestTime" TIMESTAMP(3),

    CONSTRAINT "CityStorm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityTornado" (
    "id" SERIAL NOT NULL,
    "cityId" INTEGER NOT NULL,
    "tornadoId" INTEGER NOT NULL,
    "miles" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CityTornado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Storm_stormId_key" ON "Storm"("stormId");

-- CreateIndex
CREATE UNIQUE INDEX "Storm_slug_key" ON "Storm"("slug");

-- CreateIndex
CREATE INDEX "Storm_year_idx" ON "Storm"("year");

-- CreateIndex
CREATE INDEX "Storm_name_idx" ON "Storm"("name");

-- CreateIndex
CREATE INDEX "Storm_cityCount_idx" ON "Storm"("cityCount");

-- CreateIndex
CREATE INDEX "StormPoint_stormId_idx" ON "StormPoint"("stormId");

-- CreateIndex
CREATE UNIQUE INDEX "Tornado_spcKey_key" ON "Tornado"("spcKey");

-- CreateIndex
CREATE INDEX "Tornado_date_idx" ON "Tornado"("date");

-- CreateIndex
CREATE INDEX "Tornado_mag_idx" ON "Tornado"("mag");

-- CreateIndex
CREATE INDEX "Tornado_state_idx" ON "Tornado"("state");

-- CreateIndex
CREATE UNIQUE INDEX "StormCity_slug_key" ON "StormCity"("slug");

-- CreateIndex
CREATE INDEX "StormCity_state_idx" ON "StormCity"("state");

-- CreateIndex
CREATE INDEX "StormCity_hurricaneCount_idx" ON "StormCity"("hurricaneCount");

-- CreateIndex
CREATE INDEX "StormCity_tornadoCount_idx" ON "StormCity"("tornadoCount");

-- CreateIndex
CREATE UNIQUE INDEX "StormCity_city_state_key" ON "StormCity"("city", "state");

-- CreateIndex
CREATE INDEX "CityStorm_stormId_idx" ON "CityStorm"("stormId");

-- CreateIndex
CREATE UNIQUE INDEX "CityStorm_cityId_stormId_key" ON "CityStorm"("cityId", "stormId");

-- CreateIndex
CREATE INDEX "CityTornado_tornadoId_idx" ON "CityTornado"("tornadoId");

-- CreateIndex
CREATE UNIQUE INDEX "CityTornado_cityId_tornadoId_key" ON "CityTornado"("cityId", "tornadoId");

-- AddForeignKey
ALTER TABLE "StormPoint" ADD CONSTRAINT "StormPoint_stormId_fkey" FOREIGN KEY ("stormId") REFERENCES "Storm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityStorm" ADD CONSTRAINT "CityStorm_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "StormCity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityStorm" ADD CONSTRAINT "CityStorm_stormId_fkey" FOREIGN KEY ("stormId") REFERENCES "Storm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityTornado" ADD CONSTRAINT "CityTornado_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "StormCity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityTornado" ADD CONSTRAINT "CityTornado_tornadoId_fkey" FOREIGN KEY ("tornadoId") REFERENCES "Tornado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

