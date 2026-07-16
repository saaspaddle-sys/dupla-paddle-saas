# Brief de producto — dupla

*Definido el 2026-07-16. Actualizar cuando cambie una decisión de producto; las decisiones técnicas van en [decisions.md](./decisions.md).*

## Qué es

SaaS para que clubes de pádel organicen torneos: el club carga jugadores, arma el torneo y el sistema genera las llaves automáticamente, registra resultados y hace avanzar la llave. Los jugadores y el público siguen los torneos desde una vista pública gratuita.

## Por qué

- Boom del pádel en Benito Juárez (Argentina) — mercado inicial.
- Primer usuario candidato concreto: el club de México donde es profesor un amigo de Marcelo (PM). México queda como expansión, no como mercado inicial.

## Modelo de negocio

- **Pagan los clubes** (suscripción). Cobro **manual** al principio — se activa cada club a mano y se factura por afuera; Mercado Pago se integra cuando el producto esté validado.
- **Gratuito para jugadores**: vista pública sin login, con filtros (torneos, llaves, jugadores).

## Modelo de dominio (lo estructural)

- **El club es el tenant.** El staff del club son los usuarios autenticados del sistema. Torneos, canchas e inscripciones pertenecen al club.
- **Los jugadores son perfiles globales de la plataforma**, no registros de cada club. Un jugador existe una sola vez y puede jugar torneos de cualquier club (habilita historial y rankings cross-club a futuro). Consecuencia asumida: hay que manejar identidad/duplicados al cargar jugadores — buscar antes de crear.
- La relación jugador↔torneo es la **inscripción**, y esa sí es del club.

## Alcance

**Fase 1 (primer release — con esto se corre un torneo real):**
1. Crear torneo y asociar jugadores
2. Generación automática de llaves
3. Carga de resultados y avance automático de la llave
4. Vista pública sin login: torneos, llaves y jugadores con filtros

**Fase 2 (el schema la contempla desde el día uno; la UI no existe todavía):**
- Inscripción online — el jugador se anota solo desde la vista pública (requiere resolver identidad de jugador)
- Canchas y horarios — programación de partidos (colisiones, disponibilidad)

**Fuera de alcance por ahora:**
- Cobro automatizado de suscripciones
- Rankings cross-club (los perfiles globales lo habilitan, pero no es MVP)
- Multi-país / multi-moneda (Argentina primero)
