import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

/**
 * One entry per public directory. Pages read their labels, columns and copy from
 * here so a new dataset means a config entry, not another copy of the same page.
 */
export type DatasetKey =
  | 'doctors' | 'banks' | 'aircraft' | 'trucking' | 'nutrition'
  | 'climate' | 'executives' | 'broadband' | 'demographics' | 'energy' | 'trademark'
  | 'recalls' | 'storms';

export type DatasetConfig = {
  key: DatasetKey;
  path: string;
  name: string;
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  /** Set when the upstream feed still needs a credential the project does not have. */
  blockedReason?: string;
  count: () => Promise<number>;
};

export const DATASETS: Record<DatasetKey, DatasetConfig> = {
  doctors: {
    key: 'doctors',
    path: '/doctors',
    name: 'Doctors & Providers',
    title: 'US Doctor & Provider NPI Directory',
    description: 'Every licensed doctor, clinic and medical organization with a National Provider Identifier.',
    source: 'CMS NPPES',
    sourceUrl: 'https://download.cms.gov/nppes/NPI_Files.html',
    count: () => prisma.doctor.count(),
  },
  recalls: {
    key: 'recalls',
    path: '/recalls',
    name: 'Vehicle Recalls',
    title: 'NHTSA Vehicle Safety Recall Lookup',
    description: 'Open safety recalls by model year, make and model, with the defect, the risk and the free remedy.',
    source: 'NHTSA',
    sourceUrl: 'https://www.nhtsa.gov/recalls',
    count: () => prisma.vehicle.count(),
  },
  storms: {
    key: 'storms',
    path: '/storms',
    name: 'Storm History',
    title: 'Hurricanes and Tornadoes by City',
    description: 'Every tropical system within 75 miles and every tornado within 25 miles of each US city, from the NHC and SPC records.',
    source: 'NHC HURDAT2 · SPC',
    sourceUrl: 'https://www.nhc.noaa.gov/data/',
    count: () => prisma.stormCity.count(),
  },
  banks: {
    key: 'banks',
    path: '/banks',
    name: 'Bank Branches',
    title: 'FDIC Insured Bank Branch Directory',
    description: 'Every FDIC insured branch office in the United States with address, county and establishment date.',
    source: 'FDIC BankFind',
    sourceUrl: 'https://api.fdic.gov/banks/locations',
    count: () => prisma.bankBranch.count(),
  },
  aircraft: {
    key: 'aircraft',
    path: '/aircraft',
    name: 'Aircraft Registry',
    title: 'FAA N-Number Aircraft Registry Lookup',
    description: 'Tail number lookup for every civil aircraft on the FAA registry, with manufacturer, model and registered owner.',
    source: 'FAA Aircraft Registry',
    sourceUrl: 'https://registry.faa.gov/aircraftinquiry/',
    count: () => prisma.aircraft.count(),
  },
  trucking: {
    key: 'trucking',
    path: '/trucking',
    name: 'Trucking Carriers',
    title: 'FMCSA DOT Number Carrier Lookup',
    description: 'Motor carrier census records: DOT numbers, fleet size, driver counts and operating authority.',
    source: 'FMCSA Census',
    sourceUrl: 'https://data.transportation.gov/',
    count: () => prisma.dOTCarrier.count(),
  },
  nutrition: {
    key: 'nutrition',
    path: '/nutrition',
    name: 'Food & Nutrition',
    title: 'USDA Food Nutrition Database',
    description: 'Calories, macronutrients and minerals for foods in the USDA FoodData Central database.',
    source: 'USDA FoodData Central',
    sourceUrl: 'https://fdc.nal.usda.gov/',
    count: () => prisma.foodNutrition.count(),
  },
  climate: {
    key: 'climate',
    path: '/climate',
    name: 'Climate & Frost Dates',
    title: 'US Climate Normals & Frost Date Lookup',
    description: 'Thirty-year climate normals, first and last frost dates and growing season length by weather station.',
    source: 'NOAA NCEI',
    sourceUrl: 'https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals',
    count: () => prisma.climateData.count(),
  },
  executives: {
    key: 'executives',
    path: '/executives',
    name: 'Public Companies',
    title: 'SEC Public Company Financial Directory',
    description: 'Registered public companies with CIK numbers, industry classification and reported annual financials.',
    source: 'SEC EDGAR',
    sourceUrl: 'https://www.sec.gov/edgar',
    count: () => prisma.sECExecutive.count(),
  },
  broadband: {
    key: 'broadband',
    path: '/broadband',
    name: 'Broadband Coverage',
    title: 'Internet Provider & Fiber Coverage by ZIP',
    description: 'Available internet providers, advertised speeds and fiber availability by ZIP code.',
    source: 'FCC Broadband Data Collection',
    sourceUrl: 'https://broadbandmap.fcc.gov/data-download',
    blockedReason: 'The FCC Broadband Data Collection download requires an authenticated FCC account.',
    count: () => prisma.broadbandCoverage.count(),
  },
  demographics: {
    key: 'demographics',
    path: '/demographics',
    name: 'Demographics',
    title: 'Cost of Living & Demographics by ZIP Code',
    description: 'Population, median income, rent, home values and education levels by ZIP code tabulation area.',
    source: 'US Census ACS',
    sourceUrl: 'https://www.census.gov/programs-surveys/acs',
    count: () => prisma.censusDemographic.count(),
  },
  energy: {
    key: 'energy',
    path: '/energy',
    name: 'Electricity Rates',
    title: 'Average Electricity Rates by State',
    description: 'Residential and commercial kWh rates, typical usage and average monthly bills by state.',
    source: 'EIA Open Data',
    sourceUrl: 'https://www.eia.gov/electricity/',
    count: () => prisma.utilityRate.count(),
  },
  trademark: {
    key: 'trademark',
    path: '/trademark',
    name: 'Trademarks',
    title: 'USPTO Trademark Status Lookup',
    description: 'Registered and pending US trademarks with owner, filing date and current status.',
    source: 'USPTO Open Data Portal',
    sourceUrl: 'https://data.uspto.gov/',
    blockedReason: 'USPTO retired bulkdata.uspto.gov; the replacement Open Data Portal API requires a key.',
    count: () => prisma.trademark.count(),
  },
};

export const DATASET_LIST = Object.values(DATASETS);

/**
 * Counting every table on each request is twelve queries against tables with
 * millions of rows, so the fan-out is cached rather than the page.
 */
export const liveDatasets = unstable_cache(
  async (): Promise<{ key: DatasetKey; count: number }[]> =>
    Promise.all(
      DATASET_LIST.map(async (config) => ({ key: config.key, count: await config.count().catch(() => 0) })),
    ),
  ['dataset-counts'],
  { revalidate: 3600, tags: ['dataset-counts'] },
);
