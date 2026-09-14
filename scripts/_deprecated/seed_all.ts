const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data for all niches...');

  // 1. Cars (if empty)
  const carsCount = await prisma.car.count();
  if (carsCount === 0) {
    console.log('Seeding Cars...');
    await prisma.car.createMany({
      data: [
        { make: 'Toyota', model: 'Camry', year: 2023, slug: 'toyota-camry-2023', engine: '2.5L 4-Cylinder', horsepower: 203, mpgCity: 28, mpgHighway: 39 },
        { make: 'Honda', model: 'Accord', year: 2023, slug: 'honda-accord-2023', engine: '1.5L Turbo', horsepower: 192, mpgCity: 29, mpgHighway: 37 },
        { make: 'Ford', model: 'Mustang', year: 2023, slug: 'ford-mustang-2023', engine: '5.0L V8', horsepower: 450, mpgCity: 15, mpgHighway: 24 },
      ],
      skipDuplicates: true,
    });
  }

  // 2. Salaries
  const salariesCount = await prisma.salary.count();
  if (salariesCount === 0) {
    console.log('Seeding Salaries...');
    await prisma.salary.createMany({
      data: [
        { state: 'Texas', city: 'Austin', profession: 'Software Engineer', slug: 'texas-austin-software-engineer', avgSalary: 120000, jobCount: 3500 },
        { state: 'California', city: 'San Francisco', profession: 'Data Scientist', slug: 'california-san-francisco-data-scientist', avgSalary: 145000, jobCount: 4200 },
        { state: 'New York', city: 'New York City', profession: 'Financial Analyst', slug: 'new-york-new-york-city-financial-analyst', avgSalary: 95000, jobCount: 8000 },
      ],
      skipDuplicates: true,
    });
  }

  // 3. Weather
  const weatherCount = await prisma.weather.count();
  if (weatherCount === 0) {
    console.log('Seeding Weather...');
    await prisma.weather.createMany({
      data: [
        { country: 'USA', state: 'Florida', city: 'Miami', slug: 'us-florida-miami', avgTempHigh: 84.5, avgTempLow: 72.1, rainDaysPerYear: 135, bestTimeToVisit: 'March to May' },
        { country: 'USA', state: 'Washington', city: 'Seattle', slug: 'us-washington-seattle', avgTempHigh: 60.1, avgTempLow: 45.3, rainDaysPerYear: 152, bestTimeToVisit: 'July to August' },
        { country: 'Spain', state: 'Catalonia', city: 'Barcelona', slug: 'es-catalonia-barcelona', avgTempHigh: 71.0, avgTempLow: 55.0, rainDaysPerYear: 55, bestTimeToVisit: 'May to June' },
      ],
      skipDuplicates: true,
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
