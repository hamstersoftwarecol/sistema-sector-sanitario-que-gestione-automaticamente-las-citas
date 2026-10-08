# MediCita IA — SaaS de salud con IA que agenda citas automáticamente

Plataforma SaaS para clínicas y consultorios: los **pacientes** reservan citas hablando con un **agente de IA**
(o eligiendo el horario a mano), los **médicos** gestionan su disponibilidad y su agenda, y las **clínicas** pagan
una suscripción mensual con **Stripe**. Construida con Next.js 16, React 19, TypeScript, Tailwind CSS 4,
PostgreSQL + Prisma 7 y la API de OpenAI.

## Funcionalidades

| Área | Qué incluye |
| --- | --- |
| **Asistente IA (Sofía)** | Agente con *tool calling* que entiende síntomas, sugiere especialidad, busca huecos reales, reserva, lista, reprograma y cancela citas. Deja al médico un **resumen pre-consulta**. Detecta señales de alarma y deriva a emergencias. |
| **Reserva automática** | Huecos calculados a partir del horario semanal, la duración de consulta, los bloqueos y las citas existentes. Transacciones + índice único parcial en PostgreSQL: **imposible reservar dos veces el mismo hueco**, incluso con peticiones simultáneas. |
| **Panel del paciente** | Próximas citas, reserva manual en 3 pasos, historial y cancelación. |
| **Panel del médico** | Resumen del día y del mes, agenda semanal, listado con confirmar / atendida / no asistió / cancelar, notas privadas, editor de disponibilidad, bloqueos de agenda y perfil (zona horaria, duración, confirmación automática). |
| **Suscripciones (Stripe)** | Planes Básico (gratis), Profesional y Clínica con límites reales (citas/mes y reservas por IA), Checkout, portal de cliente y webhook idempotente. |
| **Admin** | Métricas de la plataforma, MRR estimado y últimos registros. |
| **Seguridad** | Sesiones JWT firmadas en cookie `httpOnly`, contraseñas con bcrypt, control de acceso por rol en `proxy.ts` **y** en la capa de datos, validación con Zod, cabeceras de seguridad y límite diario de mensajes a la IA por usuario. |

## Stack

Next.js 16 (App Router, Server Actions, Cache Components, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 ·
PostgreSQL · Prisma ORM 7 (`@prisma/adapter-pg`) · OpenAI API · Stripe · Zod · jose · Vitest · Vercel.

## Arquitectura

```
src/
├── app/
│   ├── page.tsx                 Landing + precios
│   ├── (auth)/                  Login, registro y server actions de autenticación
│   ├── patient/                 Panel del paciente: inicio, asistente IA, reservar, mis citas
│   ├── doctor/                  Panel del médico: resumen, agenda, citas, disponibilidad, suscripción, perfil
│   ├── admin/                   Métricas de la plataforma
│   └── api/
│       ├── ai/chat/             Endpoint del agente de IA
│       ├── slots/               Huecos libres de un médico
│       ├── stripe/webhook/      Sincronización de suscripciones
│       ├── auth/signout/        Limpieza de sesiones huérfanas
│       └── health/              Health check (incluye la BD)
├── lib/
│   ├── scheduling/              Motor de agenda: zonas horarias, generación de huecos y reservas transaccionales
│   ├── ai/                      Bucle del agente, herramientas, prompt, conversación persistida y cuotas
│   ├── auth.ts · session.ts     Capa de acceso a datos (DAL) y sesión
│   ├── plans.ts · stripe.ts     Planes, límites y facturación
│   └── validation.ts            Esquemas Zod
├── proxy.ts                     Redirecciones optimistas por rol (antes llamado middleware)
prisma/
├── schema.prisma                Modelo de datos
├── migrations/                  Migraciones SQL (incluye el índice único parcial anti doble reserva)
└── seed.ts                      Datos de demostración
tests/
├── unit/                        Huecos, zonas horarias, planes y bucle del agente (OpenAI simulado)
└── integration/                 Reservas contra PostgreSQL real (carreras, límites, reprogramación, herramientas IA)
```

### Cómo funciona el agente de IA

1. El paciente escribe en `/patient/assistant`; el navegador envía solo el mensaje nuevo y el `conversationId`.
2. `POST /api/ai/chat` comprueba sesión, rol y cuota diaria, y carga la conversación **guardada en la BD**
   (incluidas las llamadas a herramientas), así el agente recuerda los horarios que ofreció en turnos anteriores.
3. `runAgent` (`src/lib/ai/agent.ts`) llama a OpenAI con estas herramientas, ejecutadas **siempre con la identidad
   del paciente autenticado**:
   `list_specialties`, `search_doctors`, `find_available_slots`, `book_appointment`,
   `list_my_appointments`, `cancel_appointment`, `reschedule_appointment`.
4. Cada herramienta valida sus argumentos con Zod y reutiliza el mismo servicio de reservas que la web, así que el
   modelo no puede saltarse ninguna regla (horarios, límites del plan, solapamientos, propiedad de la cita).
5. La respuesta incluye las acciones realizadas, que la UI muestra como tarjetas de confirmación.

## Puesta en marcha (local)

Requisitos: Node.js ≥ 20.9 (recomendado 22) y PostgreSQL 14+ (o Docker).

```bash
npm install                      # también genera el cliente de Prisma
docker compose up -d             # PostgreSQL local (opcional si ya tienes uno)
cp .env.example .env             # y rellena SESSION_SECRET (y OPENAI_API_KEY para el asistente)
npm run db:migrate               # crea las tablas
npm run db:seed                  # especialidades, médicos, paciente y admin de demostración
npm run dev                      # http://localhost:3000
```

Cuentas de demostración (contraseña `Demo1234!`):

| Rol | Correo |
| --- | --- |
| Paciente | `paciente@medicita.dev` |
| Médica (plan Profesional) | `dra.gomez@medicita.dev` |
| Médico (plan Básico, sin reservas por IA) | `dr.vargas@medicita.dev` |
| Admin | `admin@medicita.dev` |

Sin `OPENAI_API_KEY` la app funciona igualmente: el asistente se muestra como «no configurado» y se puede reservar
manualmente. Sin Stripe, la página de suscripción funciona en modo demostración.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Cadena de conexión de PostgreSQL. |
| `SESSION_SECRET` | Sí | Secreto de ≥ 32 caracteres para firmar las sesiones. |
| `APP_URL` | En producción | URL pública (redirecciones de Stripe). |
| `OPENAI_API_KEY` | Para la IA | Clave de la API de OpenAI. |
| `OPENAI_MODEL` | No | Modelo con soporte de *tool calling* (por defecto `gpt-5-mini`). |
| `AI_DAILY_MESSAGE_LIMIT` | No | Mensajes al asistente por usuario y día (por defecto 60). |
| `APP_TIMEZONE` | No | Zona horaria con la que el asistente interpreta «hoy» (por defecto `America/Bogota`). |
| `STRIPE_SECRET_KEY` | Para pagos | Clave secreta de Stripe. |
| `STRIPE_WEBHOOK_SECRET` | Para pagos | Secreto de firma del webhook. |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_CLINIC` | Para pagos | IDs de los precios mensuales recurrentes. |

## Stripe

1. Crea dos productos con precio mensual recurrente (Profesional y Clínica) y copia sus `price_…` en
   `STRIPE_PRICE_PRO` y `STRIPE_PRICE_CLINIC`.
2. Activa el **Customer Portal** en el dashboard de Stripe (permite cambiar de plan, cancelar y ver facturas).
3. Crea un webhook hacia `https://tu-dominio.com/api/stripe/webhook` con los eventos
   `checkout.session.completed` y `customer.subscription.created|updated|deleted|paused|resumed`.
4. En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook` y usa el secreto que imprime.

El webhook verifica la firma, es idempotente (tabla `StripeEvent`) y siempre consulta el estado actual de la
suscripción, por lo que tolera eventos duplicados o desordenados.

## Despliegue en Vercel

1. Crea una base de datos PostgreSQL (Neon, Supabase, Prisma Postgres… desde el Marketplace de Vercel o externa).
2. Importa el repositorio en Vercel y define las variables de entorno de la tabla anterior.
3. El script `vercel-build` ejecuta `prisma generate && prisma migrate deploy && next build`, así que las migraciones
   se aplican en cada despliegue.
4. Configura el webhook de Stripe con la URL de producción.
5. Opcional: ejecuta el seed una vez contra la BD de producción solo si quieres datos de demostración.

`GET /api/health` devuelve el estado de la app y de la base de datos para monitores externos.

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` / `build` / `start` | Desarrollo, build de producción y servidor. |
| `npm run lint` · `npm run typecheck` | ESLint y TypeScript. |
| `npm test` | Tests (los de integración solo corren si existe `TEST_DATABASE_URL`). |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:studio` | Migraciones, seed y Prisma Studio. |

Tests de integración en local (usa una base de datos **dedicada**, se vacía en cada test):

```bash
createdb medicita_test
DATABASE_URL=postgresql://…/medicita_test npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://…/medicita_test npm test
```

La CI de GitHub Actions (`.github/workflows/ci.yml`) levanta PostgreSQL y ejecuta lint, typecheck, tests y build.

## Privacidad y cumplimiento

Esta base está pensada para producción, pero los datos de salud son sensibles. Antes de lanzar con pacientes reales:

- Revisa la normativa aplicable (p. ej. Ley 1581 de 2012 en Colombia, RGPD, HIPAA) y redacta tu política de privacidad.
- Los mensajes del asistente se envían a OpenAI: valora un acuerdo de tratamiento de datos / retención cero y
  minimiza la información que se comparte.
- Define una política de retención para `AiConversation` (historial del asistente) y para las notas clínicas.
- Siguientes pasos recomendados: recordatorios por email/WhatsApp, límite de intentos de login,
  verificación de correo y auditoría de accesos.
