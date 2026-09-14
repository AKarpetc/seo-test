import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBanks() {
  console.log('Fetching FDIC institutions data...');
  
  try {
    // The FDIC API provides a dataset of all insured institutions. 
    // We use a high limit to fetch all active banks (currently ~4,000).
    const url = 'https://banks.data.fdic.gov/api/institutions?limit=10000&fields=NAME,CERT,CITY,STALP,ZIP,ADDRESS';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from FDIC API: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const data = json.data;

    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format received from FDIC API');
    }

    console.log(`Successfully fetched ${data.length} banks from FDIC.`);
    console.log('Inserting into database...');

    // Transform FDIC data to our Prisma model
    const records = data.map((item: any) => {
      const bank = item.data;
      return {
        // FDIC CERT number is uniquely identifiable for institutions, we use it as the routing proxy for now
        routingNumber: bank.CERT.toString(), 
        bankName: bank.NAME,
        address: bank.ADDRESS,
        city: bank.CITY,
        state: bank.STALP,
        zip: bank.ZIP,
      };
    });

    // Delete existing records to avoid conflicts during seed
    await prisma.bankBranch.deleteMany({});

    // Bulk insert all records
    const result = await prisma.bankBranch.createMany({
      data: records,
      skipDuplicates: true, // Just in case
    });

    console.log(`\n✅ Database seed complete! Inserted ${result.count} bank records.`);
  } catch (error) {
    console.error('Error seeding banks:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedBanks();
