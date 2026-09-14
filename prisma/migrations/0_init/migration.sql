-- CreateTable
CREATE TABLE "Salary" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "avgSalary" INTEGER NOT NULL,
    "jobCount" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" SERIAL NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "engine" TEXT,
    "horsepower" INTEGER,
    "mpgCity" INTEGER,
    "mpgHighway" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weather" (
    "id" SERIAL NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "avgTempHigh" DOUBLE PRECISION NOT NULL,
    "avgTempLow" DOUBLE PRECISION NOT NULL,
    "rainDaysPerYear" INTEGER,
    "bestTimeToVisit" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Weather_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" SERIAL NOT NULL,
    "npi" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT '1',
    "firstName" TEXT,
    "lastName" TEXT,
    "credential" TEXT,
    "clinicName" TEXT,
    "specialty" TEXT NOT NULL,
    "taxonomyCode" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "phone" TEXT,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealEstateLocation" (
    "id" SERIAL NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "avgHomePrice" INTEGER,
    "avgPropertyTax" INTEGER,
    "costOfLivingIndex" DOUBLE PRECISION,
    "population" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealEstateLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadbandCoverage" (
    "id" SERIAL NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "county" TEXT,
    "providerCount" INTEGER,
    "topProviders" TEXT,
    "maxSpeedDown" INTEGER,
    "maxSpeedUp" INTEGER,
    "fiberAvailable" BOOLEAN NOT NULL DEFAULT false,
    "cableAvailable" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadbandCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CensusDemographic" (
    "id" SERIAL NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "population" INTEGER,
    "households" INTEGER,
    "medianIncome" INTEGER,
    "medianAge" DOUBLE PRECISION,
    "medianRent" INTEGER,
    "homeValue" INTEGER,
    "ownerOccupied" DOUBLE PRECISION,
    "bachelorsPct" DOUBLE PRECISION,
    "povertyPct" DOUBLE PRECISION,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CensusDemographic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityRate" (
    "id" SERIAL NOT NULL,
    "utilityId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT,
    "ownership" TEXT,
    "customers" INTEGER,
    "avgKwhRate" DOUBLE PRECISION,
    "commercialRate" DOUBLE PRECISION,
    "avgMonthlyBill" INTEGER,
    "avgMonthlyKwh" INTEGER,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBranch" (
    "id" SERIAL NOT NULL,
    "uninum" TEXT NOT NULL,
    "cert" TEXT,
    "routingNumber" TEXT,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "county" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "established" TIMESTAMP(3),
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SECExecutive" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "cik" TEXT,
    "companyName" TEXT NOT NULL,
    "exchange" TEXT,
    "sic" TEXT,
    "industry" TEXT,
    "ceoName" TEXT,
    "ceoSalary" BIGINT,
    "totalComp" BIGINT,
    "revenue" BIGINT,
    "netIncome" BIGINT,
    "employees" INTEGER,
    "fiscalYear" INTEGER,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SECExecutive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DOTCarrier" (
    "id" SERIAL NOT NULL,
    "dotNumber" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "dbaName" TEXT,
    "fleetSize" INTEGER,
    "driverCount" INTEGER,
    "safetyRating" TEXT,
    "carrierOperation" TEXT,
    "cargoCarried" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DOTCarrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" SERIAL NOT NULL,
    "nNumber" TEXT NOT NULL,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "modelName" TEXT,
    "yearBuilt" INTEGER,
    "ownerName" TEXT,
    "ownerType" TEXT,
    "aircraftType" TEXT,
    "engineType" TEXT,
    "engineCount" INTEGER,
    "seats" INTEGER,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "statusCode" TEXT,
    "certIssueDate" TIMESTAMP(3),
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodNutrition" (
    "id" SERIAL NOT NULL,
    "fdcId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "brandOwner" TEXT,
    "category" TEXT,
    "dataType" TEXT,
    "servingSize" DOUBLE PRECISION,
    "servingUnit" TEXT,
    "calories" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,
    "sugar" DOUBLE PRECISION,
    "sodium" DOUBLE PRECISION,
    "potassium" DOUBLE PRECISION,
    "calcium" DOUBLE PRECISION,
    "iron" DOUBLE PRECISION,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodNutrition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimateData" (
    "id" SERIAL NOT NULL,
    "stationId" TEXT NOT NULL,
    "stationName" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "elevation" DOUBLE PRECISION,
    "avgTemp" DOUBLE PRECISION,
    "avgTempJan" DOUBLE PRECISION,
    "avgTempJul" DOUBLE PRECISION,
    "avgHighJul" DOUBLE PRECISION,
    "avgLowJan" DOUBLE PRECISION,
    "annualRainfall" DOUBLE PRECISION,
    "annualSnowfall" DOUBLE PRECISION,
    "firstFrostDate" TEXT,
    "lastFrostDate" TEXT,
    "growingDays" INTEGER,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClimateData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trademark" (
    "id" SERIAL NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "brandName" TEXT NOT NULL,
    "owner" TEXT,
    "ownerCity" TEXT,
    "ownerState" TEXT,
    "status" TEXT,
    "statusCode" TEXT,
    "filingDate" TIMESTAMP(3),
    "registrationDate" TIMESTAMP(3),
    "goodsServices" TEXT,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trademark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoPoi" (
    "id" SERIAL NOT NULL,
    "poiId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoPoi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSpecialtyCity" (
    "id" SERIAL NOT NULL,
    "specialty" TEXT NOT NULL,
    "taxonomyCode" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "providerCount" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSpecialtyCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierStateSummary" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "carrierCount" INTEGER NOT NULL,
    "totalTrucks" INTEGER,
    "totalDrivers" INTEGER,
    "slug" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierStateSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" SERIAL NOT NULL,
    "dataset" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rowsRead" INTEGER NOT NULL DEFAULT 0,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorText" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Salary_slug_key" ON "Salary"("slug");

-- CreateIndex
CREATE INDEX "Salary_state_city_idx" ON "Salary"("state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Car_slug_key" ON "Car"("slug");

-- CreateIndex
CREATE INDEX "Car_make_model_idx" ON "Car"("make", "model");

-- CreateIndex
CREATE UNIQUE INDEX "Weather_slug_key" ON "Weather"("slug");

-- CreateIndex
CREATE INDEX "Weather_country_city_idx" ON "Weather"("country", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_npi_key" ON "Doctor"("npi");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_slug_key" ON "Doctor"("slug");

-- CreateIndex
CREATE INDEX "Doctor_state_city_specialty_idx" ON "Doctor"("state", "city", "specialty");

-- CreateIndex
CREATE INDEX "Doctor_state_specialty_idx" ON "Doctor"("state", "specialty");

-- CreateIndex
CREATE INDEX "Doctor_specialty_idx" ON "Doctor"("specialty");

-- CreateIndex
CREATE INDEX "Doctor_zip_idx" ON "Doctor"("zip");

-- CreateIndex
CREATE UNIQUE INDEX "RealEstateLocation_slug_key" ON "RealEstateLocation"("slug");

-- CreateIndex
CREATE INDEX "RealEstateLocation_state_city_idx" ON "RealEstateLocation"("state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "BroadbandCoverage_zip_key" ON "BroadbandCoverage"("zip");

-- CreateIndex
CREATE UNIQUE INDEX "BroadbandCoverage_slug_key" ON "BroadbandCoverage"("slug");

-- CreateIndex
CREATE INDEX "BroadbandCoverage_state_city_idx" ON "BroadbandCoverage"("state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "CensusDemographic_zip_key" ON "CensusDemographic"("zip");

-- CreateIndex
CREATE UNIQUE INDEX "CensusDemographic_slug_key" ON "CensusDemographic"("slug");

-- CreateIndex
CREATE INDEX "CensusDemographic_state_city_idx" ON "CensusDemographic"("state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityRate_utilityId_key" ON "UtilityRate"("utilityId");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityRate_slug_key" ON "UtilityRate"("slug");

-- CreateIndex
CREATE INDEX "UtilityRate_state_city_idx" ON "UtilityRate"("state", "city");

-- CreateIndex
CREATE INDEX "UtilityRate_providerName_idx" ON "UtilityRate"("providerName");

-- CreateIndex
CREATE UNIQUE INDEX "BankBranch_uninum_key" ON "BankBranch"("uninum");

-- CreateIndex
CREATE UNIQUE INDEX "BankBranch_slug_key" ON "BankBranch"("slug");

-- CreateIndex
CREATE INDEX "BankBranch_state_city_idx" ON "BankBranch"("state", "city");

-- CreateIndex
CREATE INDEX "BankBranch_bankName_idx" ON "BankBranch"("bankName");

-- CreateIndex
CREATE INDEX "BankBranch_zip_idx" ON "BankBranch"("zip");

-- CreateIndex
CREATE UNIQUE INDEX "SECExecutive_ticker_key" ON "SECExecutive"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "SECExecutive_slug_key" ON "SECExecutive"("slug");

-- CreateIndex
CREATE INDEX "SECExecutive_companyName_idx" ON "SECExecutive"("companyName");

-- CreateIndex
CREATE INDEX "SECExecutive_industry_idx" ON "SECExecutive"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "DOTCarrier_dotNumber_key" ON "DOTCarrier"("dotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DOTCarrier_slug_key" ON "DOTCarrier"("slug");

-- CreateIndex
CREATE INDEX "DOTCarrier_state_city_idx" ON "DOTCarrier"("state", "city");

-- CreateIndex
CREATE INDEX "DOTCarrier_companyName_idx" ON "DOTCarrier"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "Aircraft_nNumber_key" ON "Aircraft"("nNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Aircraft_slug_key" ON "Aircraft"("slug");

-- CreateIndex
CREATE INDEX "Aircraft_state_city_idx" ON "Aircraft"("state", "city");

-- CreateIndex
CREATE INDEX "Aircraft_manufacturer_modelName_idx" ON "Aircraft"("manufacturer", "modelName");

-- CreateIndex
CREATE UNIQUE INDEX "FoodNutrition_fdcId_key" ON "FoodNutrition"("fdcId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodNutrition_slug_key" ON "FoodNutrition"("slug");

-- CreateIndex
CREATE INDEX "FoodNutrition_category_idx" ON "FoodNutrition"("category");

-- CreateIndex
CREATE INDEX "FoodNutrition_foodName_idx" ON "FoodNutrition"("foodName");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateData_stationId_key" ON "ClimateData"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateData_slug_key" ON "ClimateData"("slug");

-- CreateIndex
CREATE INDEX "ClimateData_state_city_idx" ON "ClimateData"("state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Trademark_serialNumber_key" ON "Trademark"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Trademark_slug_key" ON "Trademark"("slug");

-- CreateIndex
CREATE INDEX "Trademark_brandName_idx" ON "Trademark"("brandName");

-- CreateIndex
CREATE INDEX "Trademark_owner_idx" ON "Trademark"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "GeoPoi_poiId_key" ON "GeoPoi"("poiId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSpecialtyCity_slug_key" ON "DoctorSpecialtyCity"("slug");

-- CreateIndex
CREATE INDEX "DoctorSpecialtyCity_state_city_idx" ON "DoctorSpecialtyCity"("state", "city");

-- CreateIndex
CREATE INDEX "DoctorSpecialtyCity_specialty_idx" ON "DoctorSpecialtyCity"("specialty");

-- CreateIndex
CREATE INDEX "DoctorSpecialtyCity_providerCount_idx" ON "DoctorSpecialtyCity"("providerCount");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSpecialtyCity_specialty_city_state_key" ON "DoctorSpecialtyCity"("specialty", "city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierStateSummary_state_key" ON "CarrierStateSummary"("state");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierStateSummary_slug_key" ON "CarrierStateSummary"("slug");

-- CreateIndex
CREATE INDEX "IngestionRun_dataset_startedAt_idx" ON "IngestionRun"("dataset", "startedAt");

