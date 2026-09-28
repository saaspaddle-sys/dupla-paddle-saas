# Coordinación entre backend y frontend

Esta guía permite que backend y frontend avancen en paralelo sin confundir un contrato propuesto con una API disponible.

## Flujo recomendado

1. Backend publica una **propuesta de contrato** en un hilo único por funcionalidad.
2. Frontend revisa el caso de uso, los estados y los datos que necesita.
3. Con el acuerdo, frontend trabaja con mocks y backend implementa en su PR separado.
4. Backend entrega la **API implementada** con el OpenAPI generado, entorno y evidencia real.
5. Frontend reemplaza el mock y confirma la integración.

`apps/api` y `apps/web` se entregan en PRs separados. La propuesta no es una API disponible; OpenAPI es el contrato implementado que consume frontend.

## Ejemplo: consulta de suscripción

### Propuesta

> ## Propuesta: consultar la suscripción actual
>
> **Estado:** pendiente de acuerdo.
>
> **Objetivo:** permitir que el organizador consulte su plan y el límite de torneos activos simultáneos.
>
> **Request:** `GET /subscriptions/me`, con JWT. No recibe `clubId` ni `ownerId`.
>
> **Respuesta propuesta, caso gratuito:**
>
> ```json
> {
>   "plan": "free",
>   "status": "active",
>   "maxTournaments": 1
> }
> ```
>
> **Estados que la UI debe contemplar:** cargando, suscripción disponible, sesión inválida o vencida, usuario sin club y error temporal recuperable.
>
> **Compatibilidad:** se conserva el objeto `subscription` embebido en `GET /clubs/me`.
>
> **Fuera de alcance:** checkout y confirmación de pagos.
>
> **Pregunta para revisar:** ¿estos datos alcanzan para la pantalla prevista?

Esta propuesta es intencionalmente pequeña: si frontend necesita mostrar, por ejemplo, el uso actual de la cuota, debe pedirlo antes de que el backend implemente el endpoint. Al acordarse, se identifica como una revisión de contrato, por ejemplo `v1`.

### API implementada

Después de implementar y verificar, backend responde en el mismo hilo:

> ## Consulta de suscripción lista para integrar
>
> **Estado:** implementada y disponible en `[entorno]`.
>
> - **PR y revisión:** `[enlace al PR y commit]`.
> - **Contrato implementado:** `[enlace a apps/api/openapi.json en ese commit]`.
> - **URL base:** `[URL del entorno]`.
> - **Acceso de prueba:** organizador con plan gratuito, compartido por el canal privado acordado.
> - **Cambios respecto de la propuesta v1:** ninguno.
> - **Verificación realizada:** `[pruebas ejecutadas y resultado real]`.
>
> **Integración:** reemplazar el mock por la llamada real y comprobar el caso gratuito, sesión vencida y error recuperable.
>
> **Sin cambios:** `GET /clubs/me` conserva su respuesta anterior.

No usar “lista para integrar” si el código solo fue mergeado pero no está desplegado en un entorno accesible. Tampoco afirmar pruebas que no se ejecutaron.

## Reglas de contrato

- OpenAPI describe lo implementado; la guía del flujo no debe duplicar la especificación completa.
- Frontend debe mapear errores por `code`, nunca por el texto de `message`.
- Los cambios son aditivos por defecto. Si un contrato ya tiene consumidor, no se renombran ni eliminan rutas, campos ni códigos de error en el lugar.
- Todo cambio de contrato se comunica antes de que frontend abandone o modifique sus mocks.
- La entrega termina cuando frontend confirma que pudo integrar, no cuando backend solo compartió un enlace.

## Checklist de entrega de backend

- [ ] Propuesta de caso de uso, request, respuesta, errores y estados de UI revisada.
- [ ] Contrato acordado y mock identificado por su revisión.
- [ ] PR de API separado, con `apps/api/openapi.json` generado y actualizado.
- [ ] Entorno y versión disponibles para integración, si corresponde.
- [ ] Pruebas realmente ejecutadas comunicadas con su resultado.
- [ ] Frontend confirmó que reemplazó el mock o dejó un bloqueo concreto.

## Referencias

- [Convenciones de API](./api-conventions.md)
- [Workflow del repositorio](./workflow.md)
