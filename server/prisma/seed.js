// TrailDeck dev seed (Task 1.1).
// Demo lawyer credentials come from SEED_LAWYER_EMAIL and SEED_LAWYER_PASSWORD.
// Add them to server/.env (see server/.env.example for fake placeholder values).
// Defaults below are obviously fake and for local dev only.
import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

const SEED_LAWYER_EMAIL = process.env.SEED_LAWYER_EMAIL || "demo.lawyer@traildeck.local";
const SEED_LAWYER_PASSWORD = process.env.SEED_LAWYER_PASSWORD || "ChangeMe123!";

async function main() {
  const passwordHash = await bcryptjs.hash(SEED_LAWYER_PASSWORD, 10);

  const lawyer = await prisma.user.upsert({
    where: { email: SEED_LAWYER_EMAIL },
    update: {},
    create: {
      name: "Demo Lawyer",
      email: SEED_LAWYER_EMAIL,
      passwordHash,
      role: "LAWYER",
    },
  });

  // Client has no natural unique key, so look up by lawyer + name first.
  const clientName = "Demo Client";
  let client = await prisma.client.findFirst({
    where: { lawyerId: lawyer.id, name: clientName },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: clientName,
        email: "demo.client@traildeck.local",
        phone: "+1-555-0100",
        lawyerId: lawyer.id,
      },
    });
  }

  await prisma.case.upsert({
    where: {
      lawyerId_caseNumber: { lawyerId: lawyer.id, caseNumber: "DEMO-001" },
    },
    update: {},
    create: {
      title: "Demo Case",
      caseNumber: "DEMO-001",
      court: "Demo County Court",
      type: "Civil",
      opposingParty: "Opposing Party",
      status: "OPEN",
      lawyerId: lawyer.id,
      clientId: client.id,
    },
  });

  console.log("Seeded: lawyer, client, case");
}

try {
  await main();
} catch (err) {
  console.error("Seed failed");
  throw err;
} finally {
  await prisma.$disconnect();
}
