const fs = require('fs');
const path = require('path');

const niches = [
  { path: 'doctors', model: 'doctor', title: 'NPPES NPI Registry', desc: 'Find doctors and medical providers by NPI number.', nameField: 'firstName', idField: 'npi' },
  { path: 'broadband', model: 'broadbandCoverage', title: 'FCC Broadband Providers', desc: 'Internet service providers and coverage data.', nameField: 'providerName', idField: 'providerId' },
  { path: 'demographics', model: 'censusDemographic', title: 'Census Demographics', desc: 'Demographic data by ZIP code.', nameField: 'zip', idField: 'zip' },
  { path: 'energy', model: 'utilityRate', title: 'Utility Rates', desc: 'Energy information and average utility rates.', nameField: 'utilityName', idField: 'zip' },
  { path: 'executives', model: 'sECExecutive', title: 'SEC Executive Pay', desc: 'Executive compensation from SEC filings.', nameField: 'name', idField: 'ticker' },
  { path: 'trucking', model: 'dOTCarrier', title: 'DOT Carriers', desc: 'Trucking and logistics carriers.', nameField: 'legalName', idField: 'dotNumber' },
  { path: 'aircraft', model: 'aircraft', title: 'FAA Aircraft Registry', desc: 'Registered aircraft and owner information.', nameField: 'nNumber', idField: 'nNumber' },
  { path: 'nutrition', model: 'foodNutrition', title: 'USDA Food Data', desc: 'Nutritional information for foods.', nameField: 'description', idField: 'fdcId' },
  { path: 'climate', model: 'climateData', title: 'NOAA Climate Data', desc: 'Weather and climate historical data.', nameField: 'stationName', idField: 'stationId' },
  { path: 'trademark', model: 'trademark', title: 'USPTO Trademarks', desc: 'Registered trademarks and brand search.', nameField: 'markIdentification', idField: 'serialNumber' }
];

niches.forEach(niche => {
  const dir = path.join('src', 'app', niche.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const content = `import Link from 'next/link';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function IndexPage() {
  const records = await prisma.${niche.model}.findMany({
    take: 100,
  });

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <nav className="text-sm text-slate-500 mb-6">
          <ol className="list-none p-0 inline-flex">
            <li className="flex items-center">
              <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
              <span className="mx-2">/</span>
            </li>
            <li className="flex items-center text-slate-700 font-medium">
              ${niche.title}
            </li>
          </ol>
        </nav>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-8 py-8 border-b border-slate-100 bg-slate-50">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              ${niche.title} Directory
            </h1>
            <p className="mt-2 text-slate-600">
              ${niche.desc}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Identifier</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name / Description</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {records.map((record: any) => (
                  <tr key={record.${niche.idField}} className="hover:bg-slate-50 transition-colors relative">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-sm">
                      {record.${niche.idField}}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={\`/${niche.path}/\${encodeURIComponent(record.${niche.idField})}\`} className="text-blue-600 hover:text-blue-900 font-medium after:absolute after:inset-0">
                        {record.${niche.nameField} || 'View Details'}
                      </Link>
                    </td>
                  </tr>
                ))}
                
                {records.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-slate-500">
                      No records found. The database is currently empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

  fs.writeFileSync(path.join(dir, 'page.tsx'), content);
});
console.log('Generated index pages for all niches.');
