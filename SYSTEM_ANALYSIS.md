# ANÁLISIS DETALLADO DEL SISTEMA DE CHECKLISTS COMPLETO

## 1. VISIÓN GENERAL DEL PRODUCTO

Se trata de un sistema de gestión de inspecciones vehiculares basado en checklists dinámicos, diseñado para operaciones logísticas. Está dividido en:

- App móvil (React Native + Expo): usada por inspectores para completar checklists en el terreno.
- Panel web (Next.js): usada por revisores, supervisores, managers y admins para revisar, aprobar/rechazar y gestionar datos.
- Modelo de datos central: un checklist es la respuesta completada de un inspector para un template (plantilla) en una fecha específica.

El template define:

- Secciones organizadas (principal + dinámicas).
- Campos tipados (triStatus, yesNo, texto, número, fecha, firma, mapa de daños, fotos).
- Reglas condicionales (visibilidad de campos/secciones, bloqueos, requerimientos).
- Métricas para evaluar calidad de respuestas.

El sistema está pensado para inspecciones de transporte de carga (patentes, seguros, documentación, estado de frenos, etc.) pero es genérico y reutilizable.

## 2. APP MÓVIL (React Native + Expo)

### 2.1 Arquitectura General

Estado global: Zustand store (`checklist.store.tsx`) que mantiene:

- Template cargado.
- ValuesMap (respuestas del usuario).
- Fotos por campo.
- Secciones requeridas/reveladas.
- Banderas (flags) internas.
- Bloques de envío.

Rutas principales (expo-router):

- `/index.tsx` -> Gate de autenticación y biometría.
- `/(auth)/loginFP.tsx` -> Login por email/contraseña.
- `/(auth)/forceChangePassword.tsx` -> Cambio forzado de contraseña.
- `/(checkList)/index.tsx` -> Selector de template/asignación.
- `/(checkList)/main.tsx` -> Sección principal.
- `/(checkList)/section/[sectionId].tsx` -> Secciones dinámicas.
- `/(checkList)/Home.tsx` -> Resumen y envío.
- `/camera.tsx` -> Captura de fotos.

### 2.2 Motor de Reglas

Ubicación: `rules.engine.ts`.

El motor ejecuta reglas condicionales basadas en valores completados. Cada regla:

- Tiene un trigger: `onFieldChange`, `onSectionComplete`, `onBeforeSubmit`.
- Contiene acciones que pueden:
  - `showMessage`: mostrar modal/alerta.
  - `showSection`: revelar sección oculta.
  - `requireSection`: forzar completar sección.
  - `blockSubmit`: bloquear envío con razón.
  - `setFlag`: guardar dato interno.
  - `navigate`: redirigir a otra sección.

Métricas registradas: el motor calcula métricas agregadas sobre campos (`triStatusSummary`, `booleanSummary`) para evaluar cantidad de problemas detectados y porcentaje de cumplimiento.

### 2.3 Autenticación y Seguridad

Flujo de autenticación:

- Login: Email + contraseña -> `POST /api/auth/login` -> recibe JWT token.
- Token storage: guardado en expo-secure-store (almacenamiento encriptado nativo).
- Con token: se hace `GET /api/auth/me` para validar usuario.
- Biometría: si el dispositivo tiene huella/face, obliga desbloqueo con expo-local-authentication.
- Cambio de contraseña: si `user.mustChangePassword = true`, fuerza pantalla de cambio antes de acceder.
- Header de autorización: todo request incluye `x-session-token` (del Secure Store).

### 2.4 Tipos de Campos Soportados

- `triStatus`: `{status, obs}` - Selecciona opción + observación si aplica.
- `yesNo`: `{value}` - Botón No/Sí.
- `text`: `{value}` - Input texto (opcional multiline/uppercase).
- `number`: `{value}` - Input numérico con min/max.
- `date`: `{value}` - Picker de calendario (YYYY-MM-DD).
- `time`: `{value}` - Picker de hora.
- `select`: `{value}` - Dropdown de opciones.
- `radioGroup`: `{value}` - Botones radio.
- `multiSelect`: `{value: []}` - Checkboxes múltiples.
- `signature`: `{dataUrl}` - Canvas de firma + imagen base64.
- `damageMap`: `{value: []}` - Mapa interactivo (toca para marcar daños).
- `image` - (informacional) Muestra imagen.
- `imageGrid` - (informacional) Galería.
- `cover`: `{acknowledged}` - Modal con imagen + confirmación.
- `note`: `{value, read}` - Nota informativa (marca como leída).

### 2.5 Captura de Evidencia

- Fotos: expo-camera -> almacenadas localmente como URI, se envían en `data.photosByFieldId`.
- Firma: react-native-signature-canvas -> base64 dataURL.
- Ubicación GPS: expo-location -> captura en momento del envío con accuracy.
- Cloudinary: las fotos se suben a Cloudinary desde el backend (inicialmente base64).

### 2.6 Payload de Envío

```json
{
  "templateId": "string",
  "templateVersion": "number?",
  "data": {
    "subject": "{} - metadatos específicos del dominio (ej: patente)",
    "meta": "{} - data general",
    "values": "ValuesMap - respuestas completadas",
    "photosByFieldId": "Record<string, string[]> - URIs de fotos",
    "assignment": "{} - info de asignación si aplicaba"
  }
}
```

## 3. PANEL WEB (Next.js + MongoDB)

### 3.1 Arquitectura General

Base de datos: MongoDB (Mongoose) con modelos:

- User: usuarios (inspectores, revisores, supervisores, managers, admins).
- Session: sesiones activas (token + expiry).
- ChecklistTemplate: templates con versions (almacena full JSON).
- Checklist: respuestas completadas.
- Trip: data de viajes/asignaciones (importada, external source).
- AuditEvent: log de auditoría (acciones, cambios, IPs).
- Auth: session-based con token DB + cookie HTTP-only.
- Roles: 5 niveles con permisos granulares.

### 3.2 Stack Frontend

- React Server Components (RSC) para páginas autenticadas.
- `@tailwindcss/postcss` para estilos.
- `react-leaflet` para mapas (visualización de ubicaciones).
- `xlsx` para exportar datos.

### 3.3 Rutas Principales

- `/login` (Público) - Login (email + contraseña).
- `/register` (Público) - Registro (no habilitado aparentemente).
- `/dashboard` (Todos) - Dashboard principal (muestra roles disponibles).
- `/checklists` (reviewer+) - Tabla filtrable de checklists (aprobación/rechazo).
- `/checklists/[id]` (reviewer+) - Detalle checklist (visualizar datos + decisión).
- `/admin` (admin) - Gestión de inspectores (CRUD).
- `/admin/inspectors` (admin) - Lista inspectores.
- `/templates/editor` (admin) - Editor de templates.

### 3.4 Endpoints API Críticos

Auth:

- `POST /api/auth/login` -> Valida credenciales, crea sesión DB, devuelve token + cookie.
- `POST /api/auth/logout` -> Destruye sesión.
- `GET /api/auth/me` -> Usuario actual.
- `POST /api/auth/change-password` -> Cambiar contraseña (valida actual primero).

Asignaciones/Templates (usados por app móvil):

- `GET /api/mobile/my-assignments` -> Retorna matrix de (trip + templates disponibles) para hoy.
- `GET /api/my-assignments` -> Alias para lo anterior (fallback).
- `GET /api/templates` -> Todos los templates activos.
- `GET /api/templates/:templateId` -> Un template específico (full JSON).

Checklists:

- `GET /api/checklists` -> Listar con filtros (status, templateId, plate, decision).
- `POST /api/checklists` -> Guardar checklist completado (valida, aplica auditoría).
- `GET /api/checklists/:id` -> Detalle.
- `PATCH /api/checklists/:id` -> Actualizar decisión (approve/reject).

Admin:

- `GET /api/admin/users` -> Listar usuarios.
- `POST /api/admin/users` -> Crear usuario.
- `PATCH /api/admin/users/:id` -> Editar usuario.
- `DELETE /api/admin/users/:id` -> Eliminar (soft delete).

### 3.5 Modelo de Roles y Permisos

- inspector: `checklist.create`, `checklist.view_assigned`.
- reviewer: `checklist.view_all`.
- supervisor: `checklist.view_all`, `checklist.review`, `checklist.approve_reject`, `dashboard.metrics`.
- manager: supervisor + `special.authorize`.
- admin: all permissions.

Nota: El inspector no tiene panel web; opera solo desde app móvil.

### 3.6 Auditoría

Cada acción significativa es registrada en AuditEvent:

- Quién (email, rol, IP, user-agent).
- Cuándo.
- Qué acción.
- Sobre qué entidad.
- Estado antes/después.
- Metadata adicional.

## 4. FLUJOS PRINCIPALES DE USUARIO

### 4.1 Flujo Inspector (App Móvil)

LOGIN

- Email + contraseña.
- Si new user o `mustChangePassword=true` -> Cambio forzado.
- Si biometría disponible -> Autenticación biométrica.

SELECCIONAR ASIGNACIÓN

- `GET /api/mobile/my-assignments`.
- Matriz: (Trips del día + Templates disponibles).
- Selecciona template.
- Carga `GET /api/templates/:templateId`.

COMPLETAR CHECKLIST

- Sección principal (obligatoria).
- Llenar campos main.
- Ejecutar reglas `onFieldChange`.
- Rules pueden: hide section, show section, set flag.
- Secciones dinámicas (reveladas por rules).
- Similar a main, pero scoped a la sección.
- On complete -> ejecutar reglas `onSectionComplete`.

Resumen:

- Ver todas las secciones, % completitud.
- Ver validaciones (campos faltantes, requerimientos).
- Capturar GPS.
- Botón ENVIAR.

ENVÍO

- Ejecutar reglas `onBeforeSubmit`.
- Si `blockSubmit action` -> error.
- Validar secciones requeridas.
- `POST /api/checklists`.
- Éxito -> Mostrar modal + Limpiar store -> Volver a selector.

REPEAT O CAMBIAR CUENTA

- Volver a paso 2.

### 4.2 Flujo Revisor/Supervisor (Panel Web)

LOGIN

- Email + contraseña.
- Dashboard muestra roles disponibles.

NAVEGAR A CHECKLISTS

- Tabla con filtros (fecha, plate, template, decision status).
- Decision status: PENDING, APPROVED, REJECTED.
- Cada fila es un checklist.
- Click para abrir detalle.

REVISAR DETALLE

- Ver datos completados (values).
- Ver fotos si existen.
- Ver firma.
- Ver ubicación (pin en mapa).
- Ver auditoría (quién y cuándo se creó).
- Decisión: Aprobar, Rechazar, Pendiente.
- Guardar -> `PATCH /api/checklists/:id`.

DASHBOARD METRICS (si supervisor+)

- Ver métricas agregadas de checklists.

### 4.3 Flujo Admin (Panel Web)

ADMIN PANEL

Sección INSPECTORES:

- CRUD de usuarios.
- Crear: email, nombre, telefono, roles.
- Generar contraseña random (`set mustChangePassword=true`).
- Editar/borrar.

SECCIÓN TEMPLATES (editor web)

- Crear/editar templates JSON.
- Activar versionamiento.

AUDITORÍA

- Ver todos los eventos registrados.

## 5. FEATURES POR MÓDULO

### 5.1 Módulo de Autenticación

Web & Mobile:

- Login email + contraseña (scrypt hash + salt).
- Session-based (7 días expiry).
- Biometría mobile (fingerprint/face).
- Cambio de contraseña obligatorio (`mustChangePassword` flag).
- Logout.

Web:

- Cookie HTTP-only secure.
- DB session tracking.

Mobile:

- Secure Store para token.
- Re-auth al abrir app (biometría si disponible).

### 5.2 Módulo de Templates

Características:

- JSON-based, versioned.
- Secciones (main + dinámicas, `displayMode=rule`).
- Campos tipados con validaciones.
- Visibilidad condicional (`visibleWhen`).
- Reglas condicionales (8 tipos de acciones).
- Métricas agregadas (summary de calidad).

Almacenamiento: MongoDB + Mongoose (full JSON storage).

Replicación: Web editor -> JSON -> guardado en DB -> app móvil GET.

### 5.3 Módulo de Checklists (Respuestas)

Creación (app móvil):

- Campos completados (values).
- Fotos por campo.
- Firma.
- Ubicación GPS.
- Metadata del template (version match).

Almacenamiento:

- MongoDB Checklist model.
- Indexado por: templateId, templateVersion, inspectorId, status, submittedAt.

Estados:

- DRAFT -> SUBMITTED -> APPROVED/REJECTED.

Decisión (web):

- Revisores/supervisores pueden Aprobación/Rechazo.
- Auditoría registra cada cambio.

### 5.4 Módulo de Evidencia

Captura (mobile):

- Fotos: expo-camera -> URI local (no comprimidas aún).
- Firma: react-native-signature-canvas -> base64.
- Ubicación: expo-location -> GPS coordinates + accuracy.
- Mapa de daños: Canvas interactivo (toca para marcar).

Almacenamiento:

- En `data.photosByFieldId` durante envío.
- Backend -> carga a Cloudinary.
- URLs persistidas en Checklist.

### 5.5 Módulo de Roles y Permisos

5 roles jerárquicos con permisos específicos (ej: inspector solo puede ver asignados, admin todo).

Implementación:

- `roles.ts` en web.
- Guardados en User model.
- Evaluados en cada endpoint (`hasPermission()`).

### 5.6 Módulo de Auditoría

Qué se registra:

- Creación de checklists.
- Decisiones (aprobación/rechazo).
- Cambios de usuario.
- Cambios de password.
- Logins/logouts.

Data auditoría:

- Actor (userId, email, role, IP, user-agent).
- Timestamp.
- Acción.
- Entidad (tipo + ID).
- Before/after snapshot.
- Metadata.

Acceso: endpoint `/api/audit` para admins.

## 6. INTEGRACIONES Y SERVICIOS EXTERNOS

### 6.1 Cloudinary

Uso: upload de fotos capturadas en mobile.

- Preset unsigned: `checklist_unsigned` (no requiere token server-side).
- Metadata: se envían tags (ej: checklist ID) para tracking.
- URLs: `secure_url` se persisten en Checklist.
- Punto débil: upload inicial en base64 en app (pesado).
- Código: `cloudinaryUpload.ts` en web.

### 6.2 Expo Plugins

- `expo-camera`: captura de fotos.
- `expo-local-authentication`: biometría.
- `expo-location`: GPS.
- `expo-secure-store`: token encryptado.
- `expo-router`: navegación.
- `@react-native-community/datetimepicker`: pickers de fecha/hora.

### 6.3 Base de Datos (MongoDB)

- Connection pool via Mongoose.
- Modelos con indices para queries frecuentes.
- TTL indexes en Session (auto-cleanup).

### 6.4 Leaflet + React-Leaflet

- Visualización de mapa con pin de ubicación del checklist.
- Usado en revisión web.

## 7. PUNTOS FALTANTES, INCONSISTENCIAS Y MEJORAS POTENCIALES

### 7.1 CRÍTICOS (Afectan funcionalidad)

NO HAY SINCRONIZACIÓN OFFLINE

- Problema: si app móvil pierde conexión, el usuario pierde trabajo.
- Impacto: crítico en zonas rurales/autopistas.
- Solución propuesta: AsyncStorage para guardar draft local, sincronización inteligente (retry, merge de cambios), queue de envíos pendientes.

FOTOS EN BASE64 DURANTE ENVÍO

- Problema: enviar fotos como base64 en JSON es ineficiente (3x más peso).
- Impacto: lentitud, timeout en conexiones lentas.
- Solución propuesta:
  1. Upload de fotos directamente a Cloudinary desde mobile (sin server).
  2. Enviar solo URLs en checklist payload.

Hoy:

- `POST /api/checklists { data: { photosByFieldId: { field1: ["data:image/jpeg;base64,..."] } } }`

Mejor:

- 1. Upload cada foto -> Cloudinary (mobile direct).
- 2. Obtener URL.
- 3. `POST /api/checklists { data: { photosByFieldId: { field1: ["https://..."] } } }`

SIN VALIDACIÓN EN EL BACKEND DE ESTRUCTURA DE CHECKLIST

- Problema: backend acepta cualquier JSON en `data.*`.
- Impacto: inconsistencia si app enviase datos malformados.
- Solución: schema Zod/Joi en `POST /api/checklists`.

TEMPLATES HARDCODEADOS EN APP MÓVIL

- Problema: `checklist.template.ts` es template fallback (para testing?).
- Impacto: desajuste si se actualiza template en web.
- Solución: siempre cargar template del backend, no fallback local.

### 7.2 SEGURIDAD

SESSION TOKEN EN HEADER (NO STANDARD)

- Problema: usa `x-session-token` en lugar de `Authorization: Bearer`.
- Impacto: no sigue convención, puede confundir integraciones.
- Solución: cambiar a Bearer token standard.

CREDENTIALS EN REQUEST BODY (LOGIN)

- Problema: email/password en request body (aunque HTTPS mitiga riesgo).
- Impacto: si log se captura, credenciales expuestas.
- Solución: ya usa POST HTTPS, es aceptable, pero considerar 2FA.

CLOUDINARY UPLOAD UNSIGNED

- Problema: upload preset unsigned permite cualquiera subir.
- Impacto: abuso potencial de storage.
- Solución: usar signed uploads o whitelist por origen.

NO RATE LIMITING EN ENDPOINTS

- Problema: no hay límite de requests (app/web).
- Impacto: DDoS, brute force en login.
- Solución: implementar rate limiting (ej: express-rate-limit).

### 7.3 INCONSISTENCIAS DE DATOS

CAMPO PLATE EXTRAÍDO DE MÚLTIPLES LUGARES

- Ubicación: line 15-21 de `/api/checklists/route.ts`.
- Problema: busca plate en subject, values, meta con múltiples nombres.
- Impacto: confusión, bugs si template cambia.
- Solución: normalizar nombre de campo en spec.

VERSIONING DE TEMPLATE INCONSISTENTE

- Problema: `templateVersion` a veces viene del template, a veces del body.
- Impacto: mismo checklist podría referirse a versiones distintas.
- Solución: siempre almacenar version del template usado al momento del submit.

TRISTATUS OPCIONES POR DEFAULT POCO CLARAS

- Problema: si no hay opciones en triStatus, defaults a `["BUENO", "MALO", "NA"]`.
- Impacto: inconsistencia si template olvida opciones.
- Solución: ser explícito en spec que opciones son requeridas.

### 7.4 FUNCIONALIDAD FALTANTE (Medium Priority)

SIN BÚSQUEDA/FILTRO AVANZADA DE CHECKLISTS

- Disponible: filtro por fecha, plate, template, decision.
- Faltante: búsqueda por inspector, búsqueda por valores específicos, exportación a Excel con formatos.
- Impacto: análisis difícil para managers.

SIN NOTIFICACIONES

- Faltante: notificación cuando checklist se aprueba/rechaza.
- Impacto: inspector no sabe estado.

SIN REPORTES/DASHBOARDS AVANZADOS

- Disponible: dashboard básico (solo muestra roles).
- Faltante: gráficos de completitud por inspector, tiempo promedio de completado, tasa de rechazo, problemas comunes detectados.

SIN HISTORIAL DE CAMBIOS DE TEMPLATES

- Problema: si template se edita, no hay record de qué cambió.
- Impacto: imposible auditar cambios de criterios.

SIN REASSIGNMENTS/ESCALACIONES

- Problema: si checklist es rechazado, inspector debe hacer manualmente uno nuevo.
- Solución propuesta: manager puede reassign checklist, inspector vuelve a completar (inherit partial values?).

### 7.5 UX/PERFORMANCE

NO HAY ESTADOS DE CARGA EN TRANSICIONES

- Problema: secciones pueden tardar en cargar template.
- Impacto: confusión si app se queda en blanco.

VALIDACIONES EN TIEMPO REAL LIMITADAS

- Problema: espera a envío para validar requerimientos.
- Solución: mostrar en tiempo real qué falta.

SIN BORRADORES DE SECCIONES

- Problema: si sale de sección sin completar, se pierde trabajo.
- Verificar: hay flags + state preservation en Zustand, pero no está claro si persiste entre sesiones.

BÚSQUEDA DE TEMPLATES EN MOBILE

- Faltante: si hay 100+ templates, selector se vuelve inusable.
- Solución: agregar filtro/search.

### 7.6 INTEGRACIONES

SIN INTEGRACIÓN CON SISTEMA DE VIAJES

- Problema: Trips data viene de import externo (no clear de dónde).
- Impacto: manual y desincronizado.
- Solución: webhook/integración directa con sistema logístico.

CLOUDINARY CORS/POLICY

- Faltante: restricción de origen puede no estar configurada.
- Riesgo: upload desde cualquier dominio.

### 7.7 CÓDIGO/ARQUITECTURA

DUPLICACIÓN DE TIPOS ENTRE APP Y WEB

- Problema: `ChecklistTemplate`, `FieldKind` definidos en ambos lados.
- Solución: publicar tipos en npm package compartido.

SIN VALIDACIÓN TYPESCRIPT ESTRICTA EN WEB

- Problema: `any` usado frecuentemente en responses.
- Solución: usar `unknown` + type guards.

FALTA DE TESTS

- Problema: no hay test files (`.spec`, `.test`).
- Solución: agregar jest + testing-library.

CAMBIO DE CONTRASEÑA FORZADO PERO FLUJO UNCLEAR

- Problema: si password vence, must change, pero ¿cada cuánto?.
- Solución: documentar política de expiración.

## 8. TABLA RESUMEN: FEATURES, ESTADO Y PRIORIDAD

| Feature | Ubicación | Estado | Priority |
|---|---|---|---|
| Login + Session | Web + Mobile | Ready ✅ | Crítica |
| Biometría | Mobile | Ready ✅ | Alta |
| Templates dinámicos | Web + Mobile | Ready ✅ | Crítica |
| Reglas condicionales | Mobile | Ready ✅ | Alta |
| Fotos + firma | Mobile | Ready ✅ (ineficiente) | Media |
| Ubicación GPS | Mobile | Ready ✅ | Media |
| Auditoría | Web | Ready ✅ | Alta |
| Aprobación/rechazo | Web | Ready ✅ | Crítica |
| Roles + permisos | Web + Mobile | Ready ✅ | Crítica |
| Offline sync | Mobile | Missing ❌ | Crítica |
| Dashboard metrics | Web | Partial ⚠️ | Alta |
| Notificaciones | Web + Mobile | Missing ❌ | Media |
| Export de datos | Web | Missing ❌ | Media |
| Rate limiting | Web | Missing ❌ | Alta (Sec) |
| Schema validation | Web API | Partial ⚠️ | Alta |
| Historial templates | Web | Missing ❌ | Media |

## 9. CONCLUSIÓN ARQUITECTÓNICA

El sistema es funcional pero subestándar en:

- Resiliencia offline (crítico para mobile).
- Eficiencia de networking (fotos en base64).
- Seguridad operacional (falta rate limiting, validaciones).
- Análisis de datos (pocos dashboards).

Para producción escalable, se recomendaría:

- Sincronización offline con queue de envíos.
- Upload directo a Cloudinary (mobile) con signed URLs.
- Schema validation (Zod) en todo API.
- Rate limiting + auth hardening.
- Tests automatizados (jest + e2e).
- Monitoreo APM (error tracking, performance).
- Plan de disaster recovery (DB backups, failover).
