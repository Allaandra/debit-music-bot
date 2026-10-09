import { PrismaClient } from '@prisma/client';

// Экземпляр Prisma Client (Синглтон)
export const prisma = new PrismaClient();

// Для обратной совместимости во время рефакторинга оставляем заглушку
export async function openDb() {
    // В будущем этот метод можно будет полностью удалить,
    // так как Prisma подключается автоматически при первом запросе.
    return prisma;
}