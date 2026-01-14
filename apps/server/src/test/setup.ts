import { beforeEach, afterAll } from "bun:test";
import { prisma } from "../db/prisma.js";

beforeEach(async () => {
  // Clean database between tests (order matters due to foreign keys)
  await prisma.documentInvitation.deleteMany();
  await prisma.usersOnDocuments.deleteMany();
  await prisma.document.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
