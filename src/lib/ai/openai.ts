import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

export function isAiConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no está definida.");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function aiModel() {
  return process.env.OPENAI_MODEL || "gpt-5-mini";
}
