# Vision del Frontend

## Objetivo del producto

El frontend de dupla debe ofrecer una experiencia clara para dos escenarios:

- experiencia publica, sin login, para consultar informacion de torneos.
- experiencia privada para jugadores y staff de club con acciones autenticadas.

El objetivo principal es reducir friccion para seguir torneos, inscribirse y gestionar actividad deportiva.

## Alcance del frontend (estado actual)

Incluye:

- Home publica con accesos a torneos, partidos y ranking.
- Registro de jugador con formulario amplio.
- Login en estado de construccion.
- Estructura inicial para paneles (`admin`, `players`, `customers`).

No incluye aun:

- Integracion real con API.
- Persistencia de formularios.
- control de sesion con backend y roles activos.

## Usuarios objetivo

1. Visitante publico:

- consulta informacion general sin autenticarse.

2. Jugador autenticado:

- usara dashboard para inscripciones y gestion personal (fases siguientes).

3. Staff de club:

- gestionara modulos administrativos de torneos (fases siguientes).

## Modulos principales

- Publico (`(public)`): home, navegacion principal, contenido abierto.
- Auth (`(auth)` y alias `auth`): login/registro y rutas puente.
- Players (`(players)`): area privada orientada a jugador.
- Customers y Admin: base de paneles internos.

## Direccion esperada

- Mantener informacion competitiva general como publica.
- Reservar rutas privadas para acciones del usuario logueado.
- Consolidar gradualmente una arquitectura desacoplada de UI, estado y servicios de datos.
