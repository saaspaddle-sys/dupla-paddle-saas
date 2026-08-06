# Manual de Usuario (Borrador)

Este manual describe el uso de las funcionalidades visibles del frontend en su estado actual.

## 1. Inicio (Home)

Ruta: `/`

Qué puede hacer el usuario:

- navegar a las secciones públicas (torneos, partidos, ranking, sedes).
- acceder al registro.
- acceder al login desde el botón del header, que abre un modal.

Estado de las acciones:

- `/register` funciona.
- `/ranking` funciona, con datos de ejemplo todavía no conectados a la API.
- el login no tiene ruta propia: se abre como modal.
- `/torneos`, `/partidos`, `/jugadores` y `/sedes` siguen como links de navegación y todavía no tienen pantalla.

Captura sugerida:

- `docs/images/home-overview.png`

## 2. Registro de jugador

Ruta: `/register`

Qué puede hacer el usuario:

- completar datos de acceso.
- completar información personal.
- seleccionar categoría según sexo.
- cargar datos de contacto y preferencias de juego.

El formulario todavía no persiste: al enviarlo no se crea ninguna cuenta.

Captura sugerida:

- `docs/images/register-form.png`

## 3. Login

Acceso:

- botón `Iniciar Sesión` en el header.

Estado:

- modal funcional a nivel de UI (se abre, se cierra con `X`, con click afuera o con `Esc`).
- no existe una ruta `/login`.
- el envío todavía no autentica: no hay backend conectado.

## 4. Panel de administración

Ruta: `/admin`

Estado:

- pantalla inicial placeholder.

## 5. Preguntas frecuentes

1. ¿Necesito cuenta para ver torneos?

- No. La vista pública está pensada para consulta sin login, y es gratis para el jugador.

2. ¿Ya puedo inscribirme a torneos desde la web?

- Todavía no. La auto-inscripción online forma parte de las siguientes iteraciones.

3. ¿El login ya está conectado al backend?

- No, todavía no hay autenticación integrada con la API.

4. ¿El ranking que veo es real?

- No. Es una plantilla con datos de ejemplo hasta que exista la integración con la API.

## 6. Recomendaciones de uso

- usar un navegador actualizado.
- en mobile, usar orientación vertical para los formularios largos.
