-- Vehicle: RVs, motorcycles and trailers join the cars; complaints and crash-test
-- ratings are stored on the vehicle row so a page is still one lookup.
ALTER TABLE "Vehicle"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'car',
  ADD COLUMN "complaintCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "crashCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fireCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "injuryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deathCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "topComponents" TEXT,
  ADD COLUMN "overallRating" INTEGER,
  ADD COLUMN "frontalRating" INTEGER,
  ADD COLUMN "sideRating" INTEGER,
  ADD COLUMN "rolloverRating" INTEGER,
  ADD COLUMN "complaintsLoadedAt" TIMESTAMP(3),
  ADD COLUMN "ratingsLoadedAt" TIMESTAMP(3);

CREATE INDEX "Vehicle_category_idx" ON "Vehicle"("category");

-- ClimateData: first and last measurable snow, computed from GHCN-daily.
ALTER TABLE "ClimateData"
  ADD COLUMN "firstSnowDate" TEXT,
  ADD COLUMN "lastSnowDate" TEXT,
  ADD COLUMN "snowSeasons" INTEGER,
  ADD COLUMN "snowySeasons" INTEGER;
