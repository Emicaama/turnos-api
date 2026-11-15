const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  const counts = {
    users: await p.user.count(),
    branches: await p.branch.count(),
    specialties: await p.specialty.count(),
    patients: await p.patient.count(),
    professionals: await p.professional.count(),
    availability: await p.availability.count(),
    appointments: await p.appointment.count(),
    waitlist: await p.waitlistEntry.count(),
    binnacle: await p.binnacleRecord.count(),
    triage: await p.triageEntry.count(),
    vitals: await p.vitalSign.count(),
    prescriptions: await p.prescription.count(),
    doses: await p.doseAdministration.count(),
    wings: await p.wing.count(),
    beds: await p.bed.count(),
    protocols: await p.protocol.count(),
    admissions: await p.admission.count(),
    supplies: await p.supply.count(),
    charges: await p.charge.count(),
    accountLines: await p.accountLine.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
  await p.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
