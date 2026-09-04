#!/usr/bin/env bash
#
# Smoke test manual del slice 3 (torneos y duplas).
#
# No reemplaza a los tests automáticos (`pnpm --filter api run test:e2e`): sirve
# para recorrer la API a mano contra un entorno levantado, para una demo, o para
# verificar un deploy.
#
# Requisitos:
#   pnpm run db:up          # Postgres
#   pnpm run start:dev      # la API en :3000
#
# Uso:
#   bash apps/api/scripts/smoke-tournaments.sh
#   API=http://otro-host:3000 bash apps/api/scripts/smoke-tournaments.sh
#
# Los throttles son de 5/min por IP sobre /auth/register, /auth/login, POST
# /clubs y POST /tournaments. Este recorrido usa 4 registros, 2 logins, 2 clubes
# y 3 torneos justamente para quedar por debajo de todos. Si igual te comés un
# 429, reiniciar la API limpia la ventana: el storage del throttler es
# in-memory.
set -euo pipefail

API=${API:-http://localhost:3000}
# El DNI tiene que ser de 7 u 8 dígitos, así que el sufijo random es de 4.
SUFFIX=$((RANDOM % 9000 + 1000))

# Lee una propiedad anidada del JSON de stdin ("player.id") sin depender de jq.
read_json() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);let v=o;for(const k of '$1'.split('.'))v=v?.[k];console.log(v??'(vacio)')})"
}

register() {
  curl -s -X POST "$API/auth/register" -H 'content-type: application/json' \
    -d "{\"email\":\"$1$SUFFIX@smoke.test\",\"password\":\"Password123\",\"dni\":\"$2$SUFFIX\",\"firstName\":\"$3\",\"lastName\":\"Smoke\"}"
}
login() {
  curl -s -X POST "$API/auth/login" -H 'content-type: application/json' \
    -d "{\"email\":\"$1$SUFFIX@smoke.test\",\"password\":\"Password123\"}" | read_json accessToken
}
post()  { curl -s -X POST "$API$1" -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" -d "$2"; }
patch() { curl -s -X PATCH "$API$1" -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" -d "$2"; }
get()   { curl -s "$API$1" -H "authorization: Bearer $TOKEN"; }

echo "== 1. Dueño del club A + login =="
register ownerA 100 Ana > /dev/null
TOKEN=$(login ownerA)
echo "token: ${TOKEN:0:20}..."

echo "== 2. Club A: nace en el plan free, activo, con 1 llave =="
post /clubs '{"name":"Club Norte"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log(o.name,'->',JSON.stringify(o.subscription))})"

echo "== 3. Dos jugadores =="
PLAYER1=$(register player1 200 Beto | read_json player.id)
PLAYER2=$(register player2 300 Caro | read_json player.id)
echo "player1=$PLAYER1"
echo "player2=$PLAYER2"

echo "== 4. Crear el torneo que el plan free permite =="
TOURNAMENT1=$(post /tournaments '{"name":"Torneo Apertura 2026"}' | read_json id)
echo "torneo: $TOURNAMENT1"

echo "== 5. Inscribir la dupla -> 201 =="
post "/tournaments/$TOURNAMENT1/teams" "{\"player1Id\":\"$PLAYER1\",\"player2Id\":\"$PLAYER2\"}" | read_json player1.firstName

echo "== 6. La misma dupla al revés -> 409 duplicate_team (orden canónico) =="
post "/tournaments/$TOURNAMENT1/teams" "{\"player1Id\":\"$PLAYER2\",\"player2Id\":\"$PLAYER1\"}" | read_json code

echo "== 7. Colar clubId en el body -> 400 validation =="
post /tournaments "{\"name\":\"Colado\",\"clubId\":\"$TOURNAMENT1\"}" | read_json code

echo "== 8. Cuota del plan free: el segundo activo -> 409 con details =="
post /tournaments '{"name":"Segundo"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log(o.code, JSON.stringify(o.details))})"

echo "== 9. Cancelar, y repetir el mismo estado -> 409 =="
patch "/tournaments/$TOURNAMENT1" '{"status":"canceled"}' | read_json status
patch "/tournaments/$TOURNAMENT1" '{"status":"canceled"}' | read_json code

echo "== 10. Inscribir en un torneo cancelado -> 409 tournament_not_open =="
post "/tournaments/$TOURNAMENT1/teams" "{\"player1Id\":\"$PLAYER1\",\"player2Id\":\"$PLAYER2\"}" | read_json code

echo "== 11. Cancelar liberó el cupo: entra otro torneo, con ids en MAYÚSCULA -> 201 =="
# Regresión: el orden canónico se calcula comparando strings en Node, pero el
# CHECK compara `uuid` nativo. Los dos órdenes solo coinciden en minúscula.
TOURNAMENT2=$(post /tournaments '{"name":"Torneo Clausura"}' | read_json id)
post "/tournaments/$TOURNAMENT2/teams" \
  "{\"player1Id\":\"$(echo "$PLAYER1" | tr 'a-f' 'A-F')\",\"player2Id\":\"$(echo "$PLAYER2" | tr 'a-f' 'A-F')\"}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log(o.statusCode?('FALLO '+o.statusCode+' '+o.code):('OK -> ids en minuscula: '+o.player1.id))})"

echo "== 12. Tenancy: el club B pide el torneo del club A -> 404, no 403 =="
# Un 403 le confirmaría al club B que ese id existe.
register ownerB 400 Fede > /dev/null
TOKEN=$(login ownerB)
post /clubs '{"name":"Club Sur"}' > /dev/null
get "/tournaments/$TOURNAMENT2" | read_json code

echo "== 13. Y el listado del club B no ve ni uno del club A =="
get /tournaments \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log('items:',o.items.length,'| nextCursor:',o.nextCursor)})"
