# Carranza Dental Lab

Sitio web y panel administrativo para la gestion de solicitudes de laboratorio dental.

## Descripcion

Este proyecto incluye:

- Sitio publico para mostrar servicios y registrar solicitudes.
- Login administrativo con Firebase Authentication.
- Panel admin para gestionar pedidos, servicios, estados e ingresos.
- Persistencia de datos en Firebase Firestore.
- Carga de adjuntos en Firebase Storage (con fallback inline en local cuando aplica).

## Estructura del proyecto

```text
.
|- index.html            # Landing publica
|- styles.css            # Estilos generales del sitio
|- script.js             # Logica del sitio publico
|- login.html            # Vista de inicio de sesion admin
|- login.css             # Estilos de login
|- login.js              # Autenticacion con Firebase
|- admin.html            # Panel administrativo
|- admin.css             # Estilos del panel admin
|- admin.js              # Logica de gestion admin
|- firebase.js           # Configuracion e inicializacion Firebase
|- img/                  # Recursos visuales
|- sounds/               # Audios (alerta)
```

## Tecnologias

- HTML5
- CSS3
- JavaScript (ES Modules)
- Firebase:
  - Authentication
  - Firestore
  - Storage
- Chart.js
- jsPDF
- Remix Icon

## Requisitos

- Navegador moderno (Chrome, Edge o Firefox actualizado).
- Proyecto Firebase configurado con:
  - Authentication habilitado (email/password).
  - Firestore activo.
  - Storage activo.
- Reglas de Firestore y Storage compatibles con el uso del panel.

## Configuracion rapida

1. Verifica los datos de Firebase en `firebase.js`:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `appId`
2. Abre `index.html` con un servidor local.

Opciones simples:

- VS Code Live Server.
- Python (si lo tienes instalado):

```bash
python -m http.server 5500
```

Luego abre:

- Sitio: `http://localhost:5500/index.html`
- Login admin: `http://localhost:5500/login.html`

## Flujo funcional

### Sitio publico

- Muestra servicios (Firestore o fallback local).
- Permite enviar solicitudes con datos del cliente.
- Genera codigo de seguimiento.
- Sube adjuntos al Storage cuando esta disponible.

### Panel admin

- Requiere autenticacion.
- Lista solicitudes en tiempo real.
- Permite actualizar estado, editar/eliminar pedidos y gestionar servicios.
- Muestra KPI, graficos y resumen de ingresos.

## Seguridad recomendada

- No usar credenciales de prueba en produccion.
- Restringir reglas de Firestore/Storage por rol de usuario.
- Validar archivos y tamano maximo en Storage Rules.
- Considerar mover operaciones sensibles a Cloud Functions.

## Mejoras sugeridas

- Variables de entorno para configuracion por ambiente.
- Pipeline CI/CD para despliegue.
- Tests de integracion para formularios y panel.
- Mejorar trazabilidad de pedidos con historial de cambios.

## Autor

Carranza Dental Lab
