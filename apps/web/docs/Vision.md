# Visión del Frontend

Derivado de `docs/product-brief.md`, que manda si hay diferencia. Acá solo se traduce ese alcance a superficies de frontend.

## Vocabulario del dominio

Los mismos términos que usa el brief, para que las carpetas y las pantallas se puedan mapear sin adivinar:

- **Club** — el tenant que paga la suscripción. Dueño de torneos, canchas e inscripciones.
- **Staff del club** — usuarios autenticados que operan el panel del club.
- **Jugador** — perfil **global** de la plataforma, sin club. Puede tener cuenta propia, pero eso no lo hace usuario de ningún club.
- **Visitante** — cualquiera que mira la vista pública sin loguearse.

## Objetivo del producto

El frontend de dupla cubre dos escenarios:

- experiencia **pública, sin login**, para consultar torneos, llaves y resultados.
- experiencia **privada** para jugadores autenticados y para el staff del club.

El objetivo principal es reducir la fricción para seguir torneos, inscribirse y gestionar la actividad deportiva.

## Alcance del frontend (estado actual)

Incluye:

- Home pública con accesos a torneos, partidos y ranking.
- Registro de jugador con formulario amplio (datos de acceso, personales, categoría por sexo, contacto).
- Login como modal abierto desde el header.
- Vista pública de ranking (plantilla con datos hardcodeados).
- Estructura inicial de route groups para las áreas privadas.

Queda para fases siguientes:

- Rutas dedicadas de torneos, partidos, jugadores y sedes.
- Panel del club con funcionalidad real.
- Dashboard del jugador.

No incluye todavía:

- Integración real con la API.
- Persistencia de formularios.
- Control de sesión con backend y superficies según identidad.

## Usuarios objetivo

1. **Visitante público** — consulta información general sin autenticarse. Es la mayoría del tráfico esperado.
2. **Jugador autenticado** — perfil e historial propios, y auto-inscripción a torneos en fase 2 (fases siguientes en el frontend).
3. **Staff del club** — gestiona torneos, canchas e inscripciones del club (fases siguientes en el frontend).

Según `docs/decisions.md` (modelo de identidad, 2026-07-23) el login no lleva rol: la superficie que ve cada persona se deriva de tener un `Player`, un `Club`, o ambos.

## Módulos principales

Mapeo de carpeta a concepto de dominio:

| Carpeta       | Concepto                                                          |
| ------------- | ----------------------------------------------------------------- |
| `(public)`    | Superficie pública sin login: home, navegación, contenido abierto |
| `(auth)`      | Registro y modal de login reutilizable                            |
| `auth`        | Alias de rutas históricas hacia `(auth)`                          |
| `(players)`   | Área privada del **jugador** (perfil global, sin club)            |
| `(customers)` | Área privada del **club**: es el panel del staff del tenant       |
| `admin`       | Panel interno de plataforma (placeholder)                         |

`(customers)` es el panel del club — el nombre de la carpeta viene del cliente que paga, no de una entidad del dominio. En texto de producto y en la UI se lo llama **club**, nunca "customer".

## Dirección esperada

- Mantener pública la información competitiva general.
- Reservar las rutas privadas para acciones del usuario logueado.
- Consolidar gradualmente una arquitectura desacoplada de UI, estado y servicios de datos.
- Mantener la superficie pública libre de code paths que dependan de auth: es la que ve la mayoría de los jugadores.
