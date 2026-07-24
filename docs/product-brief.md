# Brief de producto — dupla

_Definido el 2026-07-16. Actualizar cuando cambie una decisión de producto; las decisiones técnicas van en [decisions.md](./decisions.md)._

## Qué es

SaaS para que clubes de pádel organicen torneos: el club arma el torneo con sus jugadores —que se registran solos o los carga el club—, el sistema genera las llaves automáticamente, registra resultados y hace avanzar la llave. Los jugadores y el público siguen los torneos desde una vista pública gratuita, y el jugador puede además tener cuenta propia.

## Por qué

- Boom del pádel en Benito Juárez (Argentina) — mercado inicial.
- Primer usuario candidato concreto: el club de México donde es profesor un amigo de Marcelo (PM). México queda como expansión, no como mercado inicial.

## Modelo de negocio

- **Paga el organizador** (el dueño de la cuenta), por suscripción; el plan define las cuotas de uso (p. ej. cantidad de torneos). En el MVP una cuenta = **un club**; que un mismo dueño maneje varios clubes queda para más adelante. Cobro **manual** al principio — cada cuenta se activa a mano y se factura por afuera; Mercado Pago se integra cuando el producto esté validado.
- **Gratuito para jugadores**: para el jugador todo es gratis, tenga cuenta o no. La **vista pública es anónima** (sin login), con filtros (torneos, llaves, jugadores). Además, el jugador **puede registrarse e iniciar sesión** para tener su perfil — el login habilita la cuenta de jugador, pero **no** es requisito para ver la vista pública.

## Modelo de dominio (lo estructural)

- **El club es el tenant.** El staff del club son usuarios autenticados que operan el panel del club; torneos, canchas e inscripciones pertenecen al club. Los jugadores también se autentican, pero **no** son usuarios del club: su cuenta es global (ver abajo) y no da acceso a ningún panel de club.
- **Los jugadores son perfiles globales de la plataforma**, no registros de cada club. Un jugador existe una sola vez y puede jugar torneos de cualquier club (habilita historial y rankings cross-club a futuro). Un perfil nace por dos caminos: **el jugador se registra solo**, o **el organizador lo crea** cuando hace falta (p. ej. jugador sin cuenta). Consecuencia asumida: hay que manejar identidad/duplicados en **ambos** caminos — buscar antes de crear, para que un auto-registro no duplique un perfil que el club ya cargó, ni al revés.
- La relación jugador↔torneo es la **inscripción**, y esa sí es del club.

## Alcance

**Fase 1 (primer release — con esto se corre un torneo real):**

1. Registro y login de jugadores: el jugador se registra solo o lo crea el organizador; perfil global con dedup (buscar antes de crear)
2. Crear torneo y asociar jugadores (registrados por el jugador o cargados por el club)
3. Generación automática de llaves
4. Carga de resultados y avance automático de la llave
5. Vista pública sin login: torneos, llaves y jugadores con filtros

**Fase 2 (el schema la contempla desde el día uno; la UI no existe todavía):**

- Inscripción online — el jugador logueado se anota solo a un torneo puntual desde la vista pública. Distinto de tener cuenta (eso ya está en fase 1); acá se agrega el flujo de auto-inscripción a un torneo, con la identidad de jugador ya resuelta desde fase 1
- Canchas y horarios — programación de partidos (colisiones, disponibilidad)

**Fuera de alcance por ahora:**

- Cobro automatizado de suscripciones
- Rankings cross-club (los perfiles globales lo habilitan, pero no es MVP)
- Multi-país / multi-moneda (Argentina primero)
