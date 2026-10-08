<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Notas del proyecto

- UI en español; código e identificadores en inglés.
- Prisma 7 con cliente generado en `src/generated/prisma` (no versionado): ejecuta `npm run db:generate` tras cambiar `prisma/schema.prisma`.
- Cache Components está activo: cualquier componente que lea la sesión o la base de datos va dentro de `<Suspense>`.
- Toda la lógica de reservas pasa por `src/lib/scheduling/booking.ts` (la web y las herramientas del agente de IA la comparten).
- Comprobaciones: `npm run lint && npm run typecheck && npm test && npm run build`.
