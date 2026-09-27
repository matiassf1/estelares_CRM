# Association Prototype — Technical Documentation

## Resumen

Este prototipo demuestra el flujo completo de acreditación de jugadores para un partido de fútsal: desde la creación del partido hasta el escaneo del carnet QR en cancha, con verificación HMAC-SHA256 por jugador, prevención de duplicados a prueba de race conditions vía `INSERT ON CONFLICT DO NOTHING`, y trazabilidad completa mediante `audit_log`. El objetivo es presentar a la Asociación Tucumana un sistema funcional que reemplace las planillas en papel por un flujo digital auditado y seguro.

---

## Objetivo del prototipo

Demostrar el flujo:

```
PARTIDO → ESCANEAR QR → VALIDAR → ACREDITAR → EVITAR DUPLICADO → LISTAR → PLANILLA
```

Un operador abre la acreditación de un partido, escanea carnets QR con la cámara del celular, el backend verifica la firma HMAC y la habilitación del jugador, y registra el resultado. Si el mismo jugador se escanea dos veces (incluso en simultáneo desde dos dispositivos), la base de datos garantiza un único registro. Al cerrar la acreditación, se puede imprimir la planilla oficial.

---

## Stack técnico

- **Backend:** Express + TypeScript + PostgreSQL (`pg` pool)
- **Frontend:** React 18 + Vite + Tailwind CSS
- **QR scanning:** jsqR (decodificación client-side, sin dependencias externas de cámara)
- **QR generation:** `qrcode` (npm, server-side, devuelve data URL)
- **Autenticación:** JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)
- **Migraciones:** runner secuencial casero (tabla `_migrations`)

---

## Arquitectura

Estrategia de dos deploys sobre el mismo repositorio:

- **Deploy Estelares (existente):** Railway service + PostgreSQL original. Sin cambios en tablas existentes.
- **Deploy Asociación (nuevo):** Railway service separado + PostgreSQL separado. Apunta a las mismas tablas de código pero base de datos distinta.

No se requiere variable `APP_MODE`. El aislamiento se logra por rutas: `/api/assoc/*` usan `assocAuthMiddleware` (verifica `type: 'assoc_operator'`), mientras que las rutas de Estelares usan su propio middleware. Ambas comparten `JWT_SECRET` pero los tokens son incompatibles por el campo `type`.

---

## Dominio de datos

Las entidades modelan la jerarquía real de una asociación de fútsal:

- **`associations`** — la asociación deportiva (ej. Asociación Tucumana de Fútsal)
- **`clubs`** — clubes afiliados a la asociación (ej. Estelares, Rival FC)
- **`divisions`** — categorías (ej. Primera, Segunda)
- **`seasons`** — temporadas activas (ej. Temporada 2026)
- **`teams`** — combinación club + división en una temporada
- **`players`** — jugadores con datos personales y `qr_secret` único por jugador
- **`player_registrations`** — habilitación de un jugador en un equipo para una temporada (`PENDING` / `ENABLED` / `DISABLED`)
- **`association_operators`** — usuarios del sistema (rol `ADMIN` u `OPERATOR`)
- **`matches`** — partidos con estados `SCHEDULED` → `ACCREDITATION_OPEN` → `IN_PROGRESS` → `FINISHED` / `CANCELLED`
- **`match_accreditations`** — registro único (match, player) con snapshot de validación al momento del escaneo
- **`audit_log`** — bitácora de acciones relevantes (apertura de partido, acreditación)

---

## Archivos creados

| Archivo | Descripción |
|---|---|
| `src/migrations/runner.ts` | Runner secuencial de migraciones SQL; registra archivos aplicados en tabla `_migrations` |
| `src/migrations/001_association_tables.sql` | DDL completo: 11 tablas + índices, sin modificar tablas existentes |
| `src/middleware/assocAuth.ts` | JWT middleware para operadores de asociación; verifica `type: 'assoc_operator'` |
| `src/utils/assocQr.ts` | Generación y verificación HMAC-SHA256 de carnets QR |
| `src/routes/association/auth.ts` | `POST /api/assoc/auth/login` — login de operadores |
| `src/routes/association/matches.ts` | CRUD de partidos + endpoint de acreditación race-condition-safe |
| `src/routes/association/players.ts` | Generación de QR de carnet por jugador |
| `scripts/seed-association.js` | Puebla la base de datos demo con datos de prueba |
| `scripts/reset-demo.js` | Borra todos los datos demo con guards de seguridad |
| `frontend/src/lib/assocApi.ts` | Cliente HTTP tipado para la API de asociación |
| `frontend/src/contexts/AssocAuthContext.tsx` | Context de autenticación aislado del context de Estelares |
| `frontend/src/pages/assoc/AssocLogin.tsx` | Pantalla de login para operadores |
| `frontend/src/pages/assoc/AssocMatches.tsx` | Lista de partidos con botón "Abrir acreditación" |
| `frontend/src/pages/assoc/AssocAccreditation.tsx` | Escáner de QR con cámara (jsqR) |
| `frontend/src/pages/assoc/AssocAccredited.tsx` | Lista de jugadores acreditados por equipo |
| `frontend/src/pages/assoc/AssocPlanilla.tsx` | Planilla imprimible (PDF vía print) |

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/index.ts` | Agregado: `await runMigrations()` al arrancar + mount de rutas `/api/assoc/*` |
| `frontend/src/App.tsx` | Agregado: `<AssocAuthProvider>` wrapping + 5 rutas `/assoc/*` |

---

## Rutas de API

### `POST /api/assoc/auth/login`

- **Auth:** ninguna
- **Body:** `{ username: string, password: string }`
- **Response 200:** `{ token: string, role: "ADMIN"|"OPERATOR", associationId: string }`
- **Response 401:** `{ error: "Credenciales inválidas" }`

---

### `GET /api/assoc/matches`

- **Auth:** Bearer token (assoc_operator)
- **Response 200:** array de partidos con nombres de equipos, clubes y temporada; filtrado por `association_id` del token

---

### `PATCH /api/assoc/matches/:id/open`

- **Auth:** Bearer token (assoc_operator)
- **Params:** `id` — UUID del partido
- **Efecto:** cambia `status` de `SCHEDULED` a `ACCREDITATION_OPEN`; registra en `audit_log`
- **Response 200:** partido actualizado
- **Response 404:** partido no encontrado o ya no está en estado `SCHEDULED`

---

### `POST /api/assoc/matches/:id/accredit`

- **Auth:** Bearer token (assoc_operator)
- **Params:** `id` — UUID del partido
- **Body:** `{ qr: string }` — payload crudo del QR escaneado
- **Response 200:** objeto con campo `result` que puede ser:
  - `ACCREDITED` — acreditado exitosamente; incluye datos del jugador
  - `ALREADY_ACCREDITED` — ya estaba acreditado; incluye `accreditedAt`
  - `NOT_ELIGIBLE` — registro en estado `PENDING` o `DISABLED`, o fuera de fechas
  - `NOT_IN_MATCH` — jugador no pertenece a ningún equipo del partido en esta temporada
  - `PLAYER_NOT_FOUND` — UUID válido pero jugador no existe o está eliminado
  - `INVALID_QR` — formato incorrecto o HMAC inválido
  - `ACCREDITATION_CLOSED` — el partido no está en estado `ACCREDITATION_OPEN`

---

### `GET /api/assoc/matches/:id/accreditations`

- **Auth:** Bearer token (assoc_operator)
- **Params:** `id` — UUID del partido
- **Response 200:** array de acreditaciones con datos del jugador, equipo y club, ordenado por `accredited_at ASC`
- **Response 403:** el partido no pertenece a la asociación del operador

---

### `GET /api/assoc/players/:id/carnet-qr`

- **Auth:** Bearer token (assoc_operator)
- **Params:** `id` — UUID del jugador
- **Response 200:** `{ qr: string (data URL PNG 300px), payload: string }` — el `payload` es el contenido del QR para escaneo o pruebas manuales
- **Response 404:** jugador no encontrado

---

## Seguridad del carnet QR

El payload de cada carnet tiene el formato:

```
{playerId}.{hmac}
```

donde:

```
hmac = HMAC-SHA256(ASSOC_QR_SECRET, playerId + ":" + qrSecret)[:24 hex chars]
```

Detalles importantes:

- **Split en el último punto:** el UUID del jugador contiene 4 puntos internos (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` tiene guiones, no puntos). El payload usa `lastIndexOf('.')` para separar el UUID del HMAC, evitando ambigüedad.
- **`qr_secret` por jugador:** cada jugador tiene un secreto aleatorio de 32 bytes almacenado en la columna `qr_secret`. Esto significa que el HMAC de cada jugador es completamente independiente — comprometer el carnet de un jugador no afecta a ningún otro.
- **`ASSOC_QR_SECRET`:** es el secreto del servidor. Si se rota esta variable de entorno, todos los QR emitidos quedan invalidados instantáneamente, sin necesidad de re-generar carnets individuales.
- **Verificación en dos pasos:** primero se extrae el `playerId` del QR y se busca el jugador en la base de datos para obtener su `qr_secret`; luego se calcula el HMAC esperado y se compara. Esto evita ataques de precomputation sin conocer el `qr_secret` del jugador.

---

## Flujo de acreditación

1. Operador llama `PATCH /api/assoc/matches/:id/open` → partido pasa a `ACCREDITATION_OPEN`; se registra en `audit_log`
2. Operador abre la pantalla de escaneo en `AssocAccreditation.tsx`; jsqR accede a la cámara del dispositivo
3. jsqR detecta el QR del carnet físico → obtiene el payload `{playerId}.{hmac}`
4. Frontend llama `POST /api/assoc/matches/:id/accredit` con `{ qr: payload }`
5. Backend verifica que el partido existe y pertenece a la asociación del operador
6. Backend verifica que el partido está en `ACCREDITATION_OPEN`
7. Backend extrae el `playerId` y verifica que es un UUID válido
8. Backend busca el jugador por ID y obtiene su `qr_secret`
9. Backend calcula el HMAC esperado y lo compara con el del QR
10. Backend busca registro activo (`player_registrations`) del jugador en alguno de los dos equipos del partido, para la temporada del partido
11. Backend verifica que el registro está en estado `ENABLED` y dentro de las fechas `valid_from`/`valid_until`
12. Backend ejecuta `INSERT INTO match_accreditations ... ON CONFLICT (match_id, player_id) DO NOTHING RETURNING *`
13. Si `RETURNING` trae filas → `ACCREDITED`; si no trae filas → `ALREADY_ACCREDITED`
14. Se registra en `audit_log` (solo en caso de acreditación nueva)
15. Frontend muestra resultado con nombre y foto del jugador

---

## Prevención de duplicados

La constraint `UNIQUE(match_id, player_id)` en `match_accreditations`, combinada con:

```sql
INSERT INTO match_accreditations (...)
VALUES (...)
ON CONFLICT (match_id, player_id) DO NOTHING
RETURNING *
```

garantiza que dos escaneos simultáneos del mismo carnet (desde dos dispositivos diferentes, en el mismo microsegundo) producen exactamente **una** fila en la base de datos. PostgreSQL usa el índice único como árbitro atómico: uno de los dos `INSERT` gana y retorna la fila; el otro recibe `DO NOTHING` y retorna vacío. El backend lee el largo del resultado: 0 filas → `ALREADY_ACCREDITED`.

---

## Aislamiento de Estelares

Las siguientes partes del sistema Estelares **no fueron modificadas**:

- Todos los archivos en `src/routes/` excepto la adición del mount en `src/index.ts`
- Todas las tablas existentes de Estelares (sin ALTER TABLE)
- El `AuthContext` de Estelares (`frontend/src/contexts/AuthContext.tsx`)
- El `localStorage` de Estelares (`authToken`, etc.) — el prototipo usa claves separadas (`assoc_token`, `assoc_role`, `assoc_association_id`)
- Los JWT de Estelares — el campo `type` en el payload distingue los tokens: Estelares no usa `type: 'assoc_operator'`, por lo que `assocAuthMiddleware` los rechaza con 403

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `ASSOC_QR_SECRET` | Sí | Secreto del servidor para firmar carnets QR con HMAC-SHA256 |
| `JWT_SECRET` | Sí | Compartido con Estelares; los tokens se distinguen por el campo `type` |
| `DATABASE_URL` | Sí | Conexión a la base de datos; debe ser una base separada de Estelares para el demo |
| `ALLOW_DEMO_SEEDS` | Solo para seeds | Debe ser `"true"` para ejecutar `seed-association.js` o `reset-demo.js` |

---

## Seeds y reset

### Datos de seed (`scripts/seed-association.js`)

| Entidad | Cantidad | Detalle |
|---|---|---|
| Asociaciones | 1 | Asociación Tucumana Demo (`atu-demo`) |
| Clubs | 3 | Estelares, Rival Demo, Tercer Club Demo |
| Divisiones | 1 | Primera |
| Temporadas | 1 | Temporada Demo (2026-01-01 / 2026-12-31, activa) |
| Equipos | 3 | Uno por club |
| Jugadores | 11 | 4 EST habilitados, 1 EST deshabilitado, 4 RIV habilitados, 2 TER (no en partido) |
| Partidos | 1 | Estelares Primera vs Rival Primera, en 2 horas, `SCHEDULED` |
| Operadores | 2 | Ver credenciales abajo |

### Credenciales por defecto

| Usuario | Contraseña | Rol |
|---|---|---|
| `assoc_admin` | `assocadmin123` | ADMIN |
| `operador` | `operador123` | OPERATOR |

**Nota:** el seed original en el archivo usa `assocadmin123` como contraseña del admin (no `admin123`).

### Guard de seguridad en `reset-demo.js`

El script de reset aplica dos capas de protección:

1. Requiere `ALLOW_DEMO_SEEDS=true`
2. Si `DATABASE_URL` contiene `railway.app` pero **no** contiene `demo`, `test` ni `dev`, el script aborta con error — evita borrar una base de Railway que parezca de producción

---

## Migraciones

El runner (`src/migrations/runner.ts`) mantiene una tabla `_migrations` con los archivos ya ejecutados. Al arrancar el servidor:

1. Lee todos los archivos `.sql` de `src/migrations/` ordenados lexicográficamente
2. Compara contra `_migrations`
3. Ejecuta solo los archivos nuevos, dentro de una transacción
4. Registra cada archivo ejecutado en `_migrations`

Las migraciones son **solo aditivas** — no se modifica ninguna tabla existente de Estelares. Si el schema ya está aplicado, el runner los saltea silenciosamente.

---

## Frontend routes

| Ruta | Componente | Descripción |
|---|---|---|
| `/assoc/login` | `AssocLogin` | Formulario de login para operadores |
| `/assoc/matches` | `AssocMatches` | Lista de partidos con estado y acciones |
| `/assoc/matches/:matchId/accredit` | `AssocAccreditation` | Escáner de QR con cámara |
| `/assoc/matches/:matchId/accredited` | `AssocAccredited` | Lista de acreditados por equipo |
| `/assoc/matches/:matchId/planilla` | `AssocPlanilla` | Planilla imprimible |

Todas las rutas excepto `/assoc/login` requieren token válido en `AssocAuthContext`; si no hay token, redirigen a `/assoc/login`.

---

## Flujo demo completo

1. Abrir `http://localhost:5173/assoc/login`
2. Ingresar `assoc_admin` / `assocadmin123` → redirige a `/assoc/matches`
3. Ver el partido "Estelares Primera vs Rival Primera"
4. Click "ABRIR ACREDITACIÓN" → el partido pasa a `ACCREDITATION_OPEN`
5. Click "ESCANEAR JUGADOR" → redirige a `/assoc/matches/:matchId/accredit`
6. Permitir acceso a la cámara → apuntar al carnet QR de un jugador habilitado
7. jsqR detecta el QR → llama al backend → muestra resultado verde "HABILITADO / ACREDITADO"
8. Escanear el mismo QR de nuevo → resultado amarillo "ALREADY_ACCREDITED" con timestamp
9. Escanear el carnet de Roberto Díaz (jugador DISABLED) → resultado rojo "NOT_ELIGIBLE"
10. Click "Ver acreditados" → `/assoc/matches/:matchId/accredited` → lista separada por equipo
11. Click "Ver planilla" → `/assoc/matches/:matchId/planilla` → layout imprimible, Ctrl+P para PDF

---

## Cómo correr el demo

```bash
# 1. Configurar variables de entorno (.env en la raíz)
ASSOC_QR_SECRET=tu-secreto-largo-aqui
JWT_SECRET=mismo-jwt-secret-que-estelares
DATABASE_URL=postgresql://user:pass@host:5432/association_demo
ALLOW_DEMO_SEEDS=true

# 2. Instalar dependencias (si no están)
npm install

# 3. Arrancar el backend (ejecuta migraciones automáticamente al iniciar)
npm run dev

# 4. En otra terminal: poblar la base de datos demo
ALLOW_DEMO_SEEDS=true node scripts/seed-association.js

# 5. Arrancar el frontend
cd frontend && npm run dev

# 6. Abrir en el navegador
# http://localhost:5173/assoc/login

# Para resetear y volver a seedear:
ALLOW_DEMO_SEEDS=true node scripts/reset-demo.js
ALLOW_DEMO_SEEDS=true node scripts/seed-association.js

# Para obtener el QR de un jugador (requiere token de admin):
# GET http://localhost:3001/api/assoc/players/:playerId/carnet-qr
# Authorization: Bearer <token>
```

---

## Preguntas abiertas para la asociación

Las siguientes 22 preguntas deben ser respondidas con la Asociación Tucumana antes de avanzar a producción:

1. ¿Cuántos partidos simultáneos necesita manejar el sistema?
2. ¿Los árbitros necesitan un rol separado de los operadores?
3. ¿Cómo se manejan los jugadores prestados entre clubes?
4. ¿Los carnets deben tener fecha de vencimiento?
5. ¿Se necesita control de cuántos jugadores puede acreditar cada equipo (ej. máximo 14)?
6. ¿Cómo se maneja la suspensión de un jugador mid-season?
7. ¿Los partidos necesitan actas digitales además de la planilla?
8. ¿Se necesita firma digital de la planilla?
9. ¿Cómo se manejan los reclamos post-partido?
10. ¿La asociación necesita reportes de asistencia por jugador?
11. ¿Se necesitan estadísticas de partidos (goles, faltas)?
12. ¿Cómo se manejan las sanciones disciplinarias?
13. ¿Los clubs necesitan su propio portal de gestión de plantel?
14. ¿Se necesita integración con algún sistema de pago para cuotas?
15. ¿Cómo se maneja el proceso de habilitación de jugadores nuevos?
16. ¿Se necesita carga de documentación (DNI, foto) con aprobación?
17. ¿Cuántas divisiones/categorías maneja la asociación actualmente?
18. ¿Los partidos de copa/torneo tienen reglas de acreditación diferentes?
19. ¿Se necesita modo offline para cuando hay mala conectividad en el estadio?
20. ¿Cómo se manejan los partidos reprogramados o cancelados?
21. ¿Quién es el superadministrador que crea las asociaciones?
22. ¿Se contempla multi-deporte (fútbol 11, básquet) en el futuro?

---

## Próximos pasos sugeridos

1. **Responder las 22 preguntas abiertas** con la Asociación Tucumana y ajustar el modelo de datos según las reglas reales de acreditación (cupo máximo, roles de árbitro, préstamos).
2. **Implementar gestión de plantel por club:** portal donde cada club carga jugadores, sube documentación (foto, DNI) y la asociación aprueba o rechaza habilitaciones.
3. **Agregar control de estado del partido completo:** transiciones a `IN_PROGRESS` y `FINISHED`, cierre automático de acreditación, y acta digital con resultado.
4. **Modo offline / PWA:** cachear los registros del partido en el Service Worker para operar sin conectividad y sincronizar cuando vuelva la red.
5. **Carnet físico imprimible:** endpoint que genera un PDF del carnet con foto, nombre, club y QR para plastificado o presentación digital con firma.
6. **Reportes y analytics:** dashboard de la asociación con asistencia por temporada, jugadores más activos, clubs con habilitaciones pendientes.
7. **Deploy de producción segregado:** pipeline CI/CD en Railway con migraciones automáticas, secrets en variables de entorno de Railway, y base de datos separada por entorno (staging/producción).
