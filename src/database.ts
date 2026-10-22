import { PrismaClient } from '@prisma/client';

// Экземпляр Prisma Client (Синглтон)
export const prisma = new PrismaClient();