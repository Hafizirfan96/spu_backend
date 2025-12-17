const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const punjabDistricts = [
  'Attock',
  'Bahawalnagar',
  'Bahawalpur',
  'Bhakkar',
  'Chakwal',
  'Chiniot',
  'Dera Ghazi Khan',
  'Faisalabad',
  'Gujranwala',
  'Gujrat',
  'Hafizabad',
  'Jhang',
  'Kasur',
  'Khanewal',
  'Khushab',
  'Lahore',
  'Layyah',
  'Lodhran',
  'Mandi Bahauddin',
  'Mianwali',
  'Multan',
  'Muzaffargarh',
  'Nankana Sahib',
  'Narowal',
  'Okara',
  'Pakpattan',
  'Rahim Yar Khan',
  'Rajanpur',
  'Rawalpindi',
  'Sahiwal',
  'Sargodha',
  'Sheikhupura',
  'Sialkot',
  'Toba Tek Singh',
  'Vehari',
  'Murree',
  'Talagang',
  'Kot Addu',
  'Other'
];

const posts = [
  { name: 'Assistant Director', description: 'Manage departmental initiatives and supervise teams.' },
  { name: 'Deputy Director', description: 'Oversee programs and coordinate inter-departmental efforts.' },
  { name: 'Director', description: 'Lead strategic planning and execution across the department.' }
];

async function main() {
  await prisma.district.createMany({
    data: punjabDistricts.map((name) => ({ name })),
    skipDuplicates: true
  });

  await prisma.post.createMany({
    data: posts,
    skipDuplicates: true
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seeding failed', e);
    await prisma.$disconnect();
    process.exit(1);
  });
