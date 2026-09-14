-- Airport ASOS stations often report no snowfall element, so a ZIP whose nearest
-- station has frost normals may need a different nearby station for snow dates.
ALTER TABLE "ZipClimate"
  ADD COLUMN "snowStationId" TEXT,
  ADD COLUMN "snowStationMiles" DOUBLE PRECISION;
CREATE INDEX "ZipClimate_snowStationId_idx" ON "ZipClimate"("snowStationId");
