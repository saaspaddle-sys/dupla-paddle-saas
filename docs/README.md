# Documentación de dupla

Punto de entrada a la documentación del producto y del equipo. Cada documento tiene una responsabilidad; no es necesario leerlos todos para cada tarea.

## Qué leer según la tarea

| Necesidad                                       | Referencia                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Entender el producto y sus fases                | [Brief de producto](./product-brief.md)                                                      |
| Diseñar o consumir un contrato HTTP             | [Convenciones de API](./api-conventions.md) y [OpenAPI versionado](../apps/api/openapi.json) |
| Entender entidades y relaciones                 | [Modelo de datos](./data-model.md)                                                           |
| Preparar Postgres o trabajar con migraciones    | [Guía de base de datos](./database.md)                                                       |
| Preparar una contribución                       | [Reglas de trabajo](./workflow.md) y [comandos Git](./git-guide.md)                          |
| Usar los agentes del repositorio en Claude Code | [Guía de agentes](./agents.md)                                                               |
| Entender el motivo de una decisión              | [Registro histórico de decisiones](./decisions.md)                                           |
| Trabajar en frontend                            | [Índice de documentación web](../apps/web/docs/README.md)                                    |

## Vigente, planificado e histórico

- **Vigente:** las convenciones describen las reglas actuales. El código, las migraciones y el OpenAPI generado permiten verificar qué está implementado; los detalles de cada paquete están en [API](../apps/api/AGENTS.md) y [web](../apps/web/AGENTS.md).
- **Planificado:** el brief describe el alcance objetivo, no una lista de funcionalidades entregadas. El modelo distingue tablas migradas de extensiones futuras; una tabla existente no implica que su flujo funcional esté completo.
- **Histórico:** el registro de decisiones conserva el contexto original. Las notas de reemplazo orientan hacia la vigente sin borrar la historia.

El [PNG del ERD original](./dupa-erd.drawio.png) se conserva **solo como histórico**: contiene identificadores BIGSERIAL y campos anteriores al modelo actual. No debe usarse para implementar migraciones. La referencia vigente es [el modelo de datos](./data-model.md), contrastada con el [schema de Prisma](../apps/api/prisma/schema.prisma).

## Mantener la documentación

Actualizar la referencia del tema en el mismo PR que cambia su comportamiento. Enlazarla desde otros documentos en lugar de repetir listas de funcionalidades o configuración. Al reemplazar una decisión, añadir la nueva entrada y una nota de navegación en la anterior, conservando su texto histórico.
