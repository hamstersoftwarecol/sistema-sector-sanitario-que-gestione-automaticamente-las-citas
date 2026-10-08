import { connection } from "next/server";
import { db } from "@/lib/db";

// Endpoint de salud para monitores externos (comprueba también la base de datos).
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
