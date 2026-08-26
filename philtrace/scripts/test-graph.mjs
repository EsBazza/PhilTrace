async function testGraph() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  const contractors = await prisma.contractor.findMany({
    orderBy: { totalValuePHP: 'desc' },
    take: 50,
  });

  console.log(`Top 5 Contractors in DB:`);
  for (const c of contractors.slice(0, 5)) {
    console.log(`- ${c.name}: ${c.totalContracts} contracts, PHP ${c.totalValuePHP.toLocaleString()}, ${c.overdueCount} overdue`);
  }

  // Check joint ventures
  const jvProjects = await prisma.project.count({
    where: {
      OR: [
        { contractorRaw: { contains: '&' } },
        { contractorRaw: { contains: '/' } },
        { contractorRaw: { contains: 'JV' } },
        { contractorRaw: { contains: 'JOINT VENTURE' } },
      ]
    }
  });

  console.log(`\nTotal Joint Venture Projects found in DB: ${jvProjects}`);
  await prisma.$disconnect();
}

testGraph();
