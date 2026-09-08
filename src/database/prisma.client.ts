import { PrismaClient } from "@prisma/client";

// Prevents multiple PrismaClient instances during ts-node-dev hot reloads.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
