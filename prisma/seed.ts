import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with multiple niches...')

  // 1. Seed Salaries
  const salaries = [
    { state: 'Texas', city: 'Austin', profession: 'Dental Assistant', slug: 'texas-austin-dental-assistant', avgSalary: 45000, jobCount: 1200, description: 'High demand in the Texas region with excellent growth.' },
    { state: 'California', city: 'Los Angeles', profession: 'Software Engineer', slug: 'california-los-angeles-software-engineer', avgSalary: 135000, jobCount: 25000, description: 'The tech hub of Southern California continues to grow.' },
    { state: 'New York', city: 'New York City', profession: 'Financial Analyst', slug: 'new-york-new-york-city-financial-analyst', avgSalary: 95000, jobCount: 18000, description: 'Wall Street entry level positions remain highly competitive.' }
  ]

  for (const s of salaries) {
    await prisma.salary.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    })
  }

  // 2. Seed Cars
  const cars = [
    { make: 'Toyota', model: 'Camry', year: 2023, slug: 'toyota-camry-2023', engine: '2.5L 4-Cylinder', horsepower: 203, mpgCity: 28, mpgHighway: 39 },
    { make: 'Honda', model: 'Civic', year: 2024, slug: 'honda-civic-2024', engine: '2.0L 4-Cylinder', horsepower: 158, mpgCity: 31, mpgHighway: 40 },
    { make: 'Ford', model: 'F-150', year: 2022, slug: 'ford-f-150-2022', engine: '3.5L V6', horsepower: 400, mpgCity: 18, mpgHighway: 24 }
  ]

  for (const c of cars) {
    await prisma.car.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    })
  }

  // 3. Seed Weather
  const weather = [
    { country: 'USA', state: 'Texas', city: 'Austin', slug: 'us-texas-austin', avgTempHigh: 80, avgTempLow: 60, rainDaysPerYear: 35, bestTimeToVisit: 'March to May' },
    { country: 'USA', state: 'Florida', city: 'Miami', slug: 'us-florida-miami', avgTempHigh: 84, avgTempLow: 71, rainDaysPerYear: 130, bestTimeToVisit: 'December to April' },
    { country: 'USA', state: 'Washington', city: 'Seattle', slug: 'us-washington-seattle', avgTempHigh: 60, avgTempLow: 45, rainDaysPerYear: 150, bestTimeToVisit: 'July to August' }
  ]

  for (const w of weather) {
    await prisma.weather.upsert({
      where: { slug: w.slug },
      update: {},
      create: w,
    })
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
