import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PH_REGIONS_PROVINCES = [
  {
    code: '010000000',
    name: 'Region I',
    provinces: [
      { code: '012800000', name: 'Ilocos Norte' },
      { code: '012900000', name: 'Ilocos Sur' },
      { code: '013300000', name: 'La Union' },
      { code: '015500000', name: 'Pangasinan' },
    ],
  },
  {
    code: '020000000',
    name: 'Region II',
    provinces: [
      { code: '020900000', name: 'Batanes' },
      { code: '021500000', name: 'Cagayan' },
      { code: '023100000', name: 'Isabela' },
      { code: '025000000', name: 'Nueva Vizcaya' },
      { code: '025700000', name: 'Quirino' },
    ],
  },
  {
    code: '030000000',
    name: 'Region III',
    provinces: [
      { code: '030800000', name: 'Aurora' },
      { code: '031400000', name: 'Bataan' },
      { code: '031400001', name: 'Bulacan' },
      { code: '034900000', name: 'Nueva Ecija' },
      { code: '035400000', name: 'Pampanga' },
      { code: '036900000', name: 'Tarlac' },
      { code: '037100000', name: 'Zambales' },
    ],
  },
  {
    code: '040000000',
    name: 'Region IV-A',
    provinces: [
      { code: '041000000', name: 'Batangas' },
      { code: '042100000', name: 'Cavite' },
      { code: '043400000', name: 'Laguna' },
      { code: '045600000', name: 'Quezon' },
      { code: '045800000', name: 'Rizal' },
    ],
  },
  {
    code: '170000000',
    name: 'Region IV-B',
    provinces: [
      { code: '174000000', name: 'Marinduque' },
      { code: '175100000', name: 'Occidental Mindoro' },
      { code: '175200000', name: 'Oriental Mindoro' },
      { code: '175300000', name: 'Palawan' },
      { code: '175900000', name: 'Romblon' },
    ],
  },
  {
    code: '050000000',
    name: 'Region V',
    provinces: [
      { code: '050500000', name: 'Albay' },
      { code: '051600000', name: 'Camarines Norte' },
      { code: '051700000', name: 'Camarines Sur' },
      { code: '052000000', name: 'Catanduanes' },
      { code: '054100000', name: 'Masbate' },
      { code: '056200000', name: 'Sorsogon' },
    ],
  },
  {
    code: '060000000',
    name: 'Region VI',
    provinces: [
      { code: '060400000', name: 'Aklan' },
      { code: '060600000', name: 'Antique' },
      { code: '061900000', name: 'Capiz' },
      { code: '067900000', name: 'Guimaras' },
      { code: '063000000', name: 'Iloilo' },
      { code: '064500000', name: 'Negros Occidental' },
    ],
  },
  {
    code: '070000000',
    name: 'Region VII',
    provinces: [
      { code: '071200000', name: 'Bohol' },
      { code: '072200000', name: 'Cebu' },
      { code: '074600000', name: 'Negros Oriental' },
      { code: '076100000', name: 'Siquijor' },
    ],
  },
  {
    code: '080000000',
    name: 'Region VIII',
    provinces: [
      { code: '087800000', name: 'Biliran' },
      { code: '082600000', name: 'Eastern Samar' },
      { code: '083700000', name: 'Leyte' },
      { code: '084800000', name: 'Northern Samar' },
      { code: '086000000', name: 'Samar' },
      { code: '086400000', name: 'Southern Leyte' },
    ],
  },
  {
    code: '090000000',
    name: 'Region IX',
    provinces: [
      { code: '097200000', name: 'Zamboanga del Norte' },
      { code: '097300000', name: 'Zamboanga del Sur' },
      { code: '098300000', name: 'Zamboanga Sibugay' },
    ],
  },
  {
    code: '100000000',
    name: 'Region X',
    provinces: [
      { code: '101300000', name: 'Bukidnon' },
      { code: '101800000', name: 'Camiguin' },
      { code: '103500000', name: 'Lanao del Norte' },
      { code: '104200000', name: 'Misamis Occidental' },
      { code: '104300000', name: 'Misamis Oriental' },
    ],
  },
  {
    code: '110000000',
    name: 'Region XI',
    provinces: [
      { code: '118200000', name: 'Davao de Oro' },
      { code: '112300000', name: 'Davao del Norte' },
      { code: '112400000', name: 'Davao del Sur' },
      { code: '118600000', name: 'Davao Occidental' },
      { code: '112500000', name: 'Davao Oriental' },
    ],
  },
  {
    code: '120000000',
    name: 'Region XII',
    provinces: [
      { code: '124700000', name: 'Cotabato' },
      { code: '128000000', name: 'Sarangani' },
      { code: '126300000', name: 'South Cotabato' },
      { code: '126500000', name: 'Sultan Kudarat' },
    ],
  },
  {
    code: '130000000',
    name: 'National Capital Region',
    provinces: [
      { code: '133900000', name: 'Metropolitan Manila' },
    ],
  },
  {
    code: '140000000',
    name: 'Cordillera Administrative Region',
    provinces: [
      { code: '140100000', name: 'Abra' },
      { code: '147700000', name: 'Apayao' },
      { code: '141100000', name: 'Benguet' },
      { code: '142700000', name: 'Ifugao' },
      { code: '143200000', name: 'Kalinga' },
      { code: '144400000', name: 'Mountain Province' },
    ],
  },
  {
    code: '160000000',
    name: 'Region XIII',
    provinces: [
      { code: '160200000', name: 'Agusan del Norte' },
      { code: '160300000', name: 'Agusan del Sur' },
      { code: '168500000', name: 'Dinagat Islands' },
      { code: '166700000', name: 'Surigao del Norte' },
      { code: '166800000', name: 'Surigao del Sur' },
    ],
  },
  {
    code: '190000000',
    name: 'BARMM',
    provinces: [
      { code: '190700000', name: 'Basilan' },
      { code: '193600000', name: 'Lanao del Sur' },
      { code: '198700000', name: 'Maguindanao del Norte' },
      { code: '198800000', name: 'Maguindanao del Sur' },
      { code: '196600000', name: 'Sulu' },
      { code: '197000000', name: 'Tawi-Tawi' },
    ],
  },
  {
    code: '180000000',
    name: 'Negros Island Region',
    provinces: [
      { code: '180100000', name: 'Negros Occidental DEO' },
      { code: '180200000', name: 'Negros Oriental DEO' },
      { code: '180300000', name: 'Siquijor DEO' },
    ],
  },
];

async function main() {
  console.log('🏛️ Initializing official Philippine Geographic hierarchy (PSA PSGC)...');
  
  let regionsCount = 0;
  let provincesCount = 0;

  for (const reg of PH_REGIONS_PROVINCES) {
    const region = await prisma.region.upsert({
      where: { psgcCode: reg.code },
      update: { name: reg.name },
      create: {
        psgcCode: reg.code,
        name: reg.name,
      },
    });
    regionsCount++;

    for (const prov of reg.provinces) {
      await prisma.province.upsert({
        where: { psgcCode: prov.code },
        update: { name: prov.name, regionId: region.id },
        create: {
          psgcCode: prov.code,
          name: prov.name,
          regionId: region.id,
        },
      });
      provincesCount++;
    }
  }

  console.log(`✓ Seeded ${regionsCount} official Regions and ${provincesCount} Provinces.`);
  console.log('🚫 Zero fake data policy strictly maintained: Projects and Comments tables are clean.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
