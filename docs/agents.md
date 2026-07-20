# Guía de trabajo con los agentes — dupla

Cómo usamos los subagentes de `.claude/agents/` para que el trabajo salga rápido **y** revisable. Complementa `docs/workflow.md` (ramas, PRs, merges): ahí está el proceso del equipo, acá está cómo delegar bien dentro de ese proceso.

## Lo primero: qué es un agente

Un agente es un rol con un prompt fijo, un set de herramientas acotado y **contexto propio que arranca en cero**. No ve tu conversación, no recuerda lo que hiciste hace diez minutos, y no habla con los otros agentes. Todo lo que necesita saber tiene que estar en tres lugares:

1. El `CLAUDE.md` de la raíz y el `AGENTS.md` del paquete que estés tocando — se cargan solos.
2. Su propio archivo en `.claude/agents/`, más los docs que ese archivo le mande a leer.
3. **El prompt que le escribís vos.**

El punto 3 es el único que controlás en el momento, y es donde se gana o se pierde la eficiencia. Un agente que pregunta obviedades o inventa suposiciones casi siempre recibió un pedido pobre, no es "que el modelo está tonto".

## Los cinco agentes

| Agente | Para qué | Toca código |
|---|---|---|
| `api-designer` | Contrato de una feature: módulo, endpoints, DTOs, errores | No — produce una spec |
| `db-architect` | Schema, entidades, migraciones Prisma | Sí |
| `test-engineer` | Escribir tests nuevos, dejar la suite verde | Solo archivos de test |
| `debugger` | Bug con causa raíz desconocida | Sí |
| `code-reviewer` | Revisar un diff antes del PR | No — solo lee y reporta |

Dos consecuencias prácticas de esa última columna:

- **`api-designer` y `code-reviewer` no pueden romper nada.** Usalos sin miedo y seguido; el costo de una consulta de más es cero.
- **`test-engineer` no arregla el código fuente a propósito.** Si un test destapa un bug, lo reporta y deja el test marcando el comportamiento correcto. Eso es deliberado: no queremos que "poner la suite en verde" termine cambiando la lógica de negocio sin que nadie lo mire.

## Cómo se le pide algo a un agente

Un buen pedido tiene tres cosas: **objetivo concreto, alcance explícito y criterio de terminado.**

❌ `usá el db-architect para las inscripciones`

✅ `db-architect: diseñá el schema de inscripciones a torneos. Un jugador global se inscribe a un torneo de un club, en pareja con otro jugador. Hay que poder cancelar una inscripción y saber cuándo se hizo. No toques el schema de torneos, ya está definido. Entregá tablas + migración propuesta, sin aplicarla.`

Reglas que valen para todos:

- **Un agente, una tarea.** No le pidas a `debugger` que además refactorice, ni a `test-engineer` que "de paso" agregue el endpoint que falta. Su prompt les prohíbe el trabajo lateral y con razón: mezclar diagnóstico e implementación es exactamente cómo se arma un PR imposible de revisar.
- **Decí qué NO tocar.** Es la instrucción con mejor relación esfuerzo/beneficio que existe.
- **No repitas lo que ya está en los docs.** El contexto de producto, el invariante de tenancy y las convenciones ya se cargan solos. Repetirlos gasta contexto y, peor, si tu versión de memoria difiere de la del doc, generás una contradicción.
- **Pasá rutas de archivo, no descripciones.** `revisá apps/api/src/torneos/` rinde muchísimo más que `revisá el módulo de torneos`.

## Contexto entre agentes: el handoff es tuyo

Los agentes no se pasan información entre ellos. Vos sos el cable.

El caso concreto que más se repite: `api-designer` produce una spec, y quien implementa la necesita. **Guardá la spec en un archivo** (por ejemplo `docs/specs/inscripciones.md`, o pegala en la descripción del PR) y referenciá esa ruta en el siguiente pedido. Reescribirla de memoria en el prompt garantiza que se pierda la mitad de las decisiones — que es justo la parte que hacía valiosa la spec.

Mismo criterio con `debugger`: su reporte de causa raíz va al PR. Sirve tanto al reviewer humano como a quien encuentre el mismo patrón dentro de tres meses.

## El ciclo de una feature

El orden está en `docs/workflow.md` y no lo repetimos acá. Lo que importa sobre los agentes en ese ciclo:

- **`api-designer` va antes de escribir código, no después.** Su valor es que dos personas implementando features distintas produzcan APIs que se parezcan. Corrido después, es un comentario de estilo tardío.
- **`code-reviewer` va antes de abrir el PR, con el trabajo ya commiteado** en tu rama — lee `git diff main...HEAD`. Si lo corrés con todo sin commitear el diff sale sucio y la revisión pierde precisión.
- **`code-reviewer` no reemplaza el review humano.** Es al revés: le saca al humano el trabajo mecánico (DTOs sin validar, guards faltantes, `club_id` mal scopeado) para que use sus quince minutos en la única pregunta que la máquina no contesta bien: *¿es esta la solución correcta al problema?*
- **Ante un bug, `debugger` primero.** El atajo de "ya sé qué es, lo arreglo directo" es el que produce fixes sobre el síntoma. Si de verdad ya sabés cuál es la causa, arreglalo y listo — pero entonces escribí el test de regresión igual.

## Lo que tenés que verificar vos

Delegar no transfiere la responsabilidad. Antes de commitear lo que produjo un agente:

- **Corré los comandos vos mismo.** `pnpm run test` y, sobre todo, `pnpm --filter api exec eslint "{src,test}/**/*.ts" --max-warnings 0` — el lint local con `--fix` pasa en casos donde CI falla (ver `apps/api/AGENTS.md`).
- **Leé el diff completo.** Si no podés explicar una línea en el review, no está lista para mergear.
- **Chequeá el invariante de tenancy a mano** en cualquier endpoint del club. Es la clase de bug más cara del producto y la que peor se detecta leyendo por arriba.
- **Desconfiá de lo que asume infraestructura que no existe.** Hoy `apps/api` es el scaffold pelado de NestJS: no hay Prisma, ni auth, ni `ValidationPipe` global. Un agente puede escribir DTOs con decoradores de `class-validator` que no validan nada porque falta la dependencia y el pipe. Si una feature es la primera que necesita una pieza de infraestructura, esa pieza es parte de la feature.

## Antipatrones

- **Prompt de una línea para una tarea de una hora.** El tiempo que ahorrás escribiendo el pedido lo pagás con intereses corrigiendo el resultado.
- **Usar un agente para algo que no es lo suyo** (`test-engineer` para elegir el tooling de tests de `apps/web`, por ejemplo — su prompt le dice explícitamente que eso lo decide el equipo).
- **Aceptar la salida sin correr nada.** "El agente dijo que está verde" no es que esté verde.
- **Discutirle a un agente en vez de arreglar su prompt.** Si `code-reviewer` marca sistemáticamente algo que en este repo no aplica, el bug está en `.claude/agents/code-reviewer.md`.
- **Pedirle a un agente que evada el proceso**: saltear CI, `--no-verify`, commitear a `main`. No está para eso y el equipo tampoco.

## Mantener los agentes

Los archivos de `.claude/agents/` son código del proyecto: se editan por PR y se revisan como cualquier otra cosa.

- **Cambió una convención → se actualiza el agente en el mismo PR.** Si no, los agentes siguen imponiendo la convención vieja y cada review se llena de ruido.
- **Un agente equivocado dos veces seguidas en lo mismo no es mala suerte**: falta una regla en su prompt o en `CLAUDE.md`. Agregala.
- **Reglas específicas, no adjetivos.** "Revisá bien" no cambia nada; "el `club_id` sale del usuario autenticado, nunca del request" sí.
- **Las convenciones del proyecto no van adentro de un agente.** Si es una regla que también aplica a un humano revisando a mano o a un compañero usando otra herramienta, vive en `docs/` y el agente la referencia. `docs/api-conventions.md` es el ejemplo: lo leen `api-designer`, quien implementa y quien revisa. Adentro de `.claude/agents/` queda solo el rol, las herramientas y el formato de salida.
- **Agente nuevo solo con un rol claro y repetido.** Cinco agentes que el equipo usa valen más que doce que nadie recuerda. Si aparece uno nuevo, va con su entrada en `docs/decisions.md`.

Una nota de configuración: casi todos usan `model: inherit` (heredan el modelo de tu sesión); `test-engineer` está fijado en `sonnet` a propósito, porque escribir tests siguiendo un patrón existente no necesita el modelo más caro. Si cambiás eso, que sea una decisión consciente y documentada.
