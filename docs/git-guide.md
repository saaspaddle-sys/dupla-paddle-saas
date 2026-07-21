# Guía paso a paso — git y GitHub

El "cómo" operativo del día a día: los comandos, en orden. Las **reglas** (por qué ramas cortas, qué tiene que decir un PR, qué no hacemos nunca) viven en [`workflow.md`](./workflow.md) y no se repiten acá — si hay una contradicción entre los dos, manda `workflow.md`.

Todos los comandos se corren desde la raíz del repo. Los pasos con `gh` necesitan el [GitHub CLI](https://cli.github.com/) autenticado una vez con `gh auth login`; si preferís no usarlo, esos pasos se hacen igual desde la web de GitHub.

---

## El ciclo completo, de punta a punta

### 1. Antes de empezar: partí de `main` actualizada

```bash
git checkout main
git pull origin main
```

Es el paso que más se saltea y el que más conflictos genera después. Si arrancás tu rama desde una `main` de hace tres días, estás firmando un conflicto futuro.

### 2. Creá la rama

```bash
git checkout -b feat/llaves-automaticas
```

Prefijos: `feat/` (funcionalidad nueva), `fix/` (corrección), `chore/` (mantenimiento, deps, docs, config).

Nombre en minúscula y con guiones, describiendo la tarea y no el archivo: `feat/llaves-automaticas`, no `feat/cambios` ni `feat/tournament-service`.

### 3. Trabajá y commiteá

```bash
git status                  # qué cambió
git diff                    # revisá antes de agregar
git add src/tournaments/    # agregá por path, no con "git add ." a ciegas
git commit
```

`git add .` es cómodo hasta que te lleva un `.env`, un archivo de debug o medio `dist/` al commit. Mirá el `git status` primero.

Para el mensaje, `git commit` sin `-m` te abre el editor y te deja escribir cuerpo, que es donde va el _por qué_:

```
add automatic bracket generation

Los brackets se generan al cerrar inscripciones y no al crear el torneo,
porque hasta ese momento la cantidad de parejas puede cambiar.
```

### 4. Mantené la rama al día

Si tu rama vive más de un día, traé `main` seguido en vez de una sola fusión gigante al final:

```bash
git checkout main
git pull origin main
git checkout feat/llaves-automaticas
git merge main
```

**Si el conflicto es en `pnpm-lock.yaml`, no lo resuelvas a mano:**

```bash
git checkout origin/main -- pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
```

### 5. Antes de abrir el PR

```bash
# el lint exacto que corre la CI (el script "lint" del paquete NO es el mismo)
pnpm --filter api exec eslint "{src,test}/**/*.ts" --max-warnings 0
pnpm --filter web run lint

pnpm run build
pnpm run test
pnpm --filter api run test:e2e

pnpm run format:check   # si falla, `pnpm run format` lo arregla
```

El lint de `api` es la trampa clásica: `pnpm run lint` local pasa con warnings y la CI falla con `--max-warnings 0`. El detalle está en [`apps/api/AGENTS.md`](../apps/api/AGENTS.md).

Después, pasale el agente `code-reviewer` al diff y resolvé lo que encuentre — ver [`agents.md`](./agents.md).

### 6. Subí la rama y abrí el PR

```bash
git push -u origin feat/llaves-automaticas
gh pr create --base main --fill
```

El `-u` la primera vez enlaza la rama local con la remota; después alcanza con `git push`.

Si preferís escribir la descripción a mano (qué / por qué / cómo probarlo):

```bash
gh pr create --base main --title "add automatic bracket generation" --body "..."
```

Trabajo a medias que querés mostrar:

```bash
gh pr create --draft
```

### 7. Mientras el PR está abierto

Los cambios que pidan en el review son commits nuevos en la misma rama:

```bash
git add .
git commit -m "extract seeding logic to its own method"
git push
```

El PR se actualiza solo y la CI vuelve a correr. No hace falta cerrarlo ni abrir otro.

### 8. Merge

Con la aprobación puesta y los checks `api`, `web` y `format` en verde:

```bash
gh pr merge --squash
```

El squash convierte todos los commits de la rama en uno solo sobre `main`.

### 9. Limpieza después del merge

```bash
git checkout main
git pull origin main
git fetch --prune          # borra los refs de ramas que ya no existen en GitHub
git branch -d feat/llaves-automaticas
```

En este repo las ramas remotas vienen desapareciendo solas al mergear (GitHub tiene una opción de **delete branch on merge**; si no estuviera activada, borrala vos con `git push origin --delete <rama>`). `--prune` es lo que limpia tu copia local de esos refs; sin él vas a seguir viendo ramas fantasma en `git branch -a` durante meses — y si intentás borrar una que ya no existe, `git push --delete` te va a decir `remote ref does not exist`, que es inofensivo.

Si `git branch -d` se queja de que la rama "no está mergeada", es por el squash: reescribe los commits con un SHA nuevo, así que git no reconoce tu rama como incluida aunque el contenido esté en `main`. Verificá que el contenido está y usá `-D`:

```bash
git diff main feat/llaves-automaticas    # vacío = no hay nada que perder
git branch -D feat/llaves-automaticas
```

---

## Modelo de ramas

**Una sola rama de larga vida: `main`.** Es la default, está protegida, y todo entra por PR. Las ramas de tarea salen de `main` y vuelven a `main`.

No usamos una rama `develop` intermedia. Dos razones:

- Todavía no hay producción — hoy no habría nada que `develop` proteja.
- Choca con el squash merge: el squash reescribe los SHAs, así que una rama de larga vida nunca comparte historia real con `main` y las dos aparecen divergidas aunque el contenido sea idéntico.

Cuando exista un deploy productivo se reevalúa, y si se adopta va con su entrada en [`decisions.md`](./decisions.md).

---

## Situaciones comunes

**Empecé a trabajar sobre `main` sin querer** (todavía sin commitear) — los cambios sin commitear no pertenecen a ninguna rama, así que te los llevás:

```bash
git checkout -b feat/lo-que-estaba-haciendo
```

**Ya commiteé sobre `main`** — mové el commit a una rama y dejá `main` como estaba:

```bash
git branch feat/rescate        # marca tu commit
git reset --hard origin/main   # ⚠️ descarta lo no commiteado
git checkout feat/rescate
```

**Me equivoqué en el último mensaje de commit** (sin pushear todavía):

```bash
git commit --amend
```

Si ya lo pusheaste, dejalo — reescribir historia ya publicada rompe la copia de la otra persona.

**Quiero descartar todo lo que hice y volver a como está en GitHub:**

```bash
git checkout .                 # descarta cambios en archivos ya trackeados
git clean -fd                  # ⚠️ borra archivos nuevos sin trackear
```

**Me pushearon cambios a mi rama y no puedo pushear:**

```bash
git pull --rebase
git push
```

**No sé en qué estado estoy:**

```bash
git status --short --branch    # rama actual y archivos modificados
git log --oneline -10          # últimos commits
git branch -a                  # todas las ramas, locales y remotas
```

---

## Lo que nunca hacemos

Está en [`workflow.md`](./workflow.md#lo-que-no-hacemos). Los dos que más duelen en la práctica:

- `git push --force` sobre una rama compartida — le reescribís la historia a la otra persona.
- Commitear `.env`, `node_modules/` o `dist/`. Si algo así entró al repo, borrarlo en un commit posterior **no** lo saca de la historia: avisá antes de seguir.
