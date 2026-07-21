# Guía de trabajo colaborativo — dupla

Cómo trabajamos en este monorepo. Es la referencia para todo el equipo; si una regla deja de servir, se cambia por PR como cualquier otra cosa.

Este archivo tiene las **reglas**. Los **comandos** en orden — el ciclo completo de una tarea, de crear la rama a limpiar después del merge — están en [git-guide.md](./git-guide.md).

## Ramas

- **`main` es sagrada**: siempre está en verde y siempre se puede deployar. Nadie commitea directo a `main` — todo entra por PR con CI verde.
- **Ramas cortas por tarea**, con prefijo según el tipo: `feat/llaves-automaticas`, `fix/duplicados-jugadores`, `chore/actualizar-deps`.
- **Vida máxima de una rama: 2-3 días.** Si una feature es más grande, se parte en PRs que se puedan mergear de a uno (schema primero, endpoints después, UI al final). Las ramas largas son la fuente número uno de conflictos dolorosos.
- Actualizá tu rama con `main` seguido (`git pull origin main` y resolvés de a poco), no una sola vez gigante al final.

## Pull Requests

- **Un PR = una unidad de trabajo revisable.** Si no se puede revisar en ~15 minutos, probablemente son dos PRs.
- **Cambios API + frontend de la misma feature van juntos** en el mismo PR — esa es la ventaja del monorepo: el endpoint y la pantalla que lo consume se revisan y mergean como una unidad, sin ventanas donde el contrato está roto.
- La descripción dice **qué** cambia, **por qué**, y **cómo probarlo**. Si implementa una spec de `api-designer`, pegala o linkeala.
- **Regla de oro antes de abrir el PR**: pasale el agente `code-reviewer` al diff y resolvé los hallazgos. El review humano es para lo que la máquina no ve (¿es la solución correcta?), no para cazar DTOs sin validar.
- **Al menos una aprobación** de otro miembro antes de mergear. El autor mergea su propio PR una vez aprobado y con los checks `api`, `web` y `format` en verde.
- Trabajo a medias que querés mostrar → **Draft PR**.
- Merge con **squash**: un PR = un commit en `main`, con la historia limpia y revertible.

## Commits

- Mensajes en minúscula, descriptivos: `fix duplicate player detection on csv import` y no `fix` ni `cambios`.
- El mensaje dice el **por qué** cuando no es obvio — el código ya dice el qué.
- Commits atómicos dentro de la rama; con squash merge no hace falta obsesionarse, pero cada commit debería compilar.

## Reglas del monorepo

- **`pnpm install` siempre desde la raíz.** Nunca `npm`/`yarn`, nunca instalar dentro de un package. La versión de pnpm está pineada en el `package.json` raíz.
- **Conflicto en `pnpm-lock.yaml`**: no lo resuelvas a mano. Aceptá la versión de `main` (`git checkout origin/main -- pnpm-lock.yaml`) y corré `pnpm install` para regenerarlo con tus cambios.
- Después de cada pull que toque el lockfile: `pnpm install`.
- Comandos por app con `--filter`: `pnpm --filter api run test`, `pnpm --filter web run dev`. Atajos comunes en el `package.json` raíz.
- **Las apps no se importan entre sí.** Código compartido (tipos de DTOs, validaciones) irá a un package `packages/shared` cuando haga falta — se crea en ese momento, no antes.

## Decisiones y documentación

- **Decisión técnica nueva** (una librería, un patrón, un cambio de convención) → entrada en `docs/decisions.md` **en el mismo PR que la introduce**. La discusión pasa en el PR; el doc registra el resultado.
- **Cambio de alcance o de producto** → `docs/product-brief.md`, conversado con todo el equipo antes.
- Si cambiás una convención de código, actualizá `CLAUDE.md` o el agente correspondiente en el mismo PR — si no, los agentes van a seguir imponiendo la convención vieja.

## El ciclo de una feature con los agentes

1. `api-designer` produce la spec (módulo, endpoints, DTOs, errores) → se comparte con el equipo antes de escribir código.
2. Si toca schema: `db-architect` diseña tablas y migración.
3. Se implementa (API y UI en la misma rama).
4. `test-engineer` cubre lo nuevo con tests.
5. `code-reviewer` sobre el diff → se corrigen los hallazgos.
6. PR → review humano → squash merge.

Para bugs: `debugger` primero (causa raíz), fix con su test de regresión, PR normal.

## Lo que no hacemos

- Push directo a `main`, aunque "es un cambio chiquito".
- Mergear con CI rojo o "arreglarlo en el próximo PR".
- `--no-verify`, silenciar tests o bajar la severidad de lint para pasar el CI.
- PRs de 2000 líneas mezclando refactor + feature + formato.
- Resolver el lockfile a mano o commitear `node_modules`/`.env`.
