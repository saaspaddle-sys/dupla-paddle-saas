# Manual de Usuario (Borrador)

Este manual describe el uso de las funcionalidades visibles del frontend en su estado actual.

## 1. Inicio (Home)

Ruta: `/`

Que puede hacer el usuario:

- navegar a secciones publicas (torneos, partidos, ranking, sedes).
- acceder al registro.
- acceder al login desde el boton del header, que abre un modal.

Estado de las acciones:

- `/register` funciona.
- el login no tiene ruta propia; se abre como modal.
- `/torneos`, `/partidos`, `/players` y `/sedes` siguen como links de navegacion y todavia no tienen pantalla final.

Captura sugerida:

- `docs/images/home-overview.png`

## 2. Registro de jugador

Ruta: `/register`

Que puede hacer el usuario:

- completar datos de acceso.
- completar informacion personal.
- seleccionar categoria segun sexo.
- cargar datos de contacto y preferencias de juego.

Captura sugerida:

- `docs/images/register-form.png`

## 3. Login

Acceso:

- boton `Iniciar Sesion` en el header.

Estado:

- modal funcional.
- no existe una ruta `/login`.

## 4. Panel de administracion

Ruta: `/admin`

Estado:

- pantalla inicial placeholder.

## 5. Preguntas frecuentes

1. Necesito cuenta para ver torneos?

- No. La vista publica esta pensada para consulta sin login.

2. Ya puedo inscribirme a torneos desde la web?

- Aun no. Esa funcionalidad forma parte de las siguientes iteraciones.

3. El login ya esta conectado al backend?

- No, todavia no hay autenticacion integrada con API.

## 6. Recomendaciones de uso

- usar navegador actualizado.
- en mobile, usar orientacion vertical para formularios largos.
