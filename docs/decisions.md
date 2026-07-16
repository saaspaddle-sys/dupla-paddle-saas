# Decisiones técnicas — dupla

Una entrada por decisión, la más nueva arriba de su tema. Las entradas no se editan ni se borran: si una decisión se revierte, se agrega una entrada nueva que la reemplaza y se linkea a la vieja.

## 2026-07-16 — Tenancy: el club es el tenant

**Contexto**: SaaS B2B — pagan los clubes; los jugadores no tienen cuenta en fase 1.
**Decisión**: toda entidad de negocio del club (torneos, canchas, inscripciones) lleva `club_id` indexado. Los usuarios del sistema son el staff de los clubes.
**Consecuencias**: los guards y las queries de endpoints del club filtran siempre por el `club_id` del usuario autenticado — nunca por un `club_id` que venga del request sin verificar. La vista pública es read-only y sin auth.

## 2026-07-16 — Jugadores como perfiles globales

**Contexto**: los jugadores rotan entre clubes; se quiere habilitar historial y rankings cross-club como diferencial futuro.
**Decisión**: `Player` es una entidad de plataforma, **sin** `club_id`. Su vínculo con clubes es vía inscripciones a torneos.
**Consecuencias**: hay que resolver duplicados al cargar jugadores (búsqueda/match antes de crear). Quién puede editar un perfil global queda por definir en fase 2, cuando exista la inscripción online.

## 2026-07-16 — PostgreSQL + Prisma

**Decisión**: PostgreSQL como única base de datos. Prisma como ORM: schema declarativo en `prisma/schema.prisma`, migraciones con `prisma migrate`.
**Consecuencias**: Prisma no genera migraciones de reversa — revertir un cambio es una nueva migración hacia adelante. El `PrismaService` se inyecta vía DI de Nest como cualquier provider.

## 2026-07-16 — Auth propia: Passport + JWT

**Contexto**: los usuarios de fase 1 son staff de clubes — pocos, sin necesidad de social login ni SSO.
**Decisión**: autenticación propia con Passport + JWT (el camino estándar de Nest). Sin proveedor externo.
**Consecuencias**: sin costo por usuario ni dependencia de terceros. La identidad de jugadores (fase 2, inscripción online) se diseñará sobre esta misma base.

## 2026-07-16 — Cobro manual, pasarela diferida

**Decisión**: sin integración de pagos en el MVP. Clubes se activan a mano. Cuando se valide el producto, la pasarela es Mercado Pago (mercado inicial: Argentina).

## 2026-07-16 — Hosting: pendiente

**Estado**: decisión diferida a propósito hasta acercarse al primer deploy. No bloquea el desarrollo.
