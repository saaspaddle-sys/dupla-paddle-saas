Roadmap de Desarrollo: Dashboard de Clubes (customers)

1. Estructura de Rutas y Layout Base

-Crear src/app/(customers)/layout.tsx con la estructura visual fija (Sidebar lateral + Top Header).

-Diseñar el componente clubSidebar.tsx con la navegación principal:

    -Resumen / Métrica

    -Mis Torneos

    -Mis Canchas / Sede

    -Mis Jugadores / Inscriptos

    -Publicidad & Sponsors

    -Configuración & Suscripción

-Configurar la navegación responsive (menú colapsable o hamburguesa para dispositivos móviles).

2. Vista Principal / Resumen (/customers/page.tsx)

-Implementar tarjetas de métricas clave (KPIs):

    -Torneos activos / en curso.

    -Total de inscriptos en el mes.

    -Ingresos generados por inscripciones.

    -Estado de la suscripción actual (Ej: Plan Basic o Plan Pro).

-Agregar panel de "Accesos Rápidos" (ej. Crear nuevo torneo, Cargar jugador).

-Agregar listado rápido de "Próximas Fechas" asociadas al club.

3. Módulo de Gestión de Torneos (/customers/torneos)

-Lista de Torneos (page.tsx): Tabla o grilla con filtros (Activos, Finalizados, Borradores) y estado de cada torneo.

-Creación / Edición de Torneo (/torneos/nuevo o /torneos/[id]):

    -Formulario paso a paso (Wizard):

        - Paso 1: Datos Generales (Nombre del torneo, fechas de inicio/fin, categoría, banner promocional).

        - Paso 2: Formato y Canchas (Reglamento, límite de parejas, sedes/canchas asignadas).

        - Paso 3: Precios y Pagos (Costo de inscripción, datos CBU/Alias para cobro).

-Detalle del Torneo (/torneos/[id]/gestion):

    -Control de inscriptos y parejas confirmadas.

    -Armado de cuadros/zonas (brackets).

    -Carga de resultados de partidos en vivo.

4. Módulo de Jugadores e Inscriptos (/customers/jugadores)

- Tabla general de jugadores asociados al club.

- Buscador por DNI, nombre o categoría.

- Formulario/Modal para alta manual de un jugador que no usó la app.

- Exportación de padrones de inscriptos (ej. reporte Excel o PDF con la lista para mesa de control).

5. Módulo de Publicidad y Banners - Exclusivo Plan Pro (/customers/publicidad)

-Panel para gestión de sponsors/patrocinadores locales.

-Formulario para subir banners publicitarios que aparecerán en la vista pública del torneo.

-Bloqueo visual o paywall si el usuario está en Plan Basic ("Actualizá a Pro para personalizar sponsors").

6. Módulo de Configuración del Club y Suscripción (/customers/suscripcion)

-Perfil del Club: Editar nombre, dirección, logo, foto de portada y redes sociales.

-Gestión de Canchas: Carga de cantidad de canchas disponibles y tipo de superficie.

-Panel de Suscripción SaaS:

    -Indicador del plan activo (Basic vs Pro).

    -Botón para cambiar de plan / checkout de pago.

    -Historial de facturas/comprobantes abonados a la plataforma.

7. Integración, Permisos y Protección de Rutas

-Aplicar Middleware o verificación de sesión para impedir que usuarios sin rol club o sin autenticarse entren a /(customers).

-Validaciones visuales según el estado de la suscripción (habilitar o deshabilitar features Pro).