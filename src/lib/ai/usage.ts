import "server-only";
import { db } from "@/lib/db";

export function dailyAiLimit() {
  const value = Number(process.env.AI_DAILY_MESSAGE_LIMIT);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

/** Suma un mensaje al contador diario del usuario y devuelve si aún está dentro del límite. */
export async function consumeAiQuota(userId: string, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const usage = await db.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 1 },
    update: { count: { increment: 1 } },
  });
  const limit = dailyAiLimit();
  return { allowed: usage.count <= limit, remaining: Math.max(0, limit - usage.count) };
}
