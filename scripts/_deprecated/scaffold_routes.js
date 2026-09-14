const fs = require('fs');
const path = require('path');

const routes = [
  { path: 'broadband/[zip]', param: 'zip', title: 'Broadband Coverage' },
  { path: 'demographics/[zip]', param: 'zip', title: 'Demographics & Housing' },
  { path: 'energy/[city]', param: 'city', title: 'Utility Rates' },
  { path: 'banks/[routing]', param: 'routing', title: 'Bank Info' },
  { path: 'executives/[ticker]', param: 'ticker', title: 'Executive Compensation' },
  { path: 'trucking/[dot]', param: 'dot', title: 'Trucking Carrier Safety' },
  { path: 'aircraft/[n_number]', param: 'n_number', title: 'Aircraft Registry' },
  { path: 'nutrition/[food]', param: 'food', title: 'Food Nutrition' },
  { path: 'climate/[city]', param: 'city', title: 'Climate & Weather Data' },
  { path: 'trademark/[brand]', param: 'brand', title: 'Trademark Search' }
];

routes.forEach(route => {
  const dirPath = path.join(__dirname, 'src', 'app', ...route.path.split('/'));
  fs.mkdirSync(dirPath, { recursive: true });
  
  const content = `import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma'; // Assuming prisma is exported from here or similar

export default async function Page({ params }: { params: { ${route.param}: string } }) {
  // Decode the parameter
  const decodedParam = decodeURIComponent(params.${route.param});

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">${route.title}: {decodedParam}</h1>
        <p className="text-gray-600">
          This is an auto-generated programmatic SEO page for the ${route.title} niche. 
          Data will be streamed from S3 into PostgreSQL and rendered here.
        </p>
      </div>
    </div>
  );
}
`;
  
  fs.writeFileSync(path.join(dirPath, 'page.tsx'), content);
  console.log(`Created route: /${route.path}`);
});
