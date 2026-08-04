# Design: QR fijo del carnet + escaneo portero + hardening API

**Date:** 2026-08-03  
**Status:** Approved in conversation (model + section 2); hardening scope = option A  
**Goal:** Socios sin datos pueden mostrar un QR fijo del carnet (o captura); el portero lo escanea y registra el ingreso. Mantener el flujo actual del QR rotativo. Endurecer el backend contra abuso básico de API.

## Context

- Hoy el ingreso exige que el **socio** tenga red (`POST /api/check-in` con token rotativo).
- El portero siempre tiene internet; los socios a veces no.
- Ideal operativo: el socio abre el carnet en casa (o guarda captura del QR) y en la puerta el portero escanea.
- Ya existe corrección de timezone para “ingresos hoy” (`CAST((checked_in_at - INTERVAL '3 hours') AS DATE)`).

## Non-goals

- Mitigación DDoS a nivel red/borde (Cloudflare, etc.) — queda fuera; se documenta como mejora futura.
- Reemplazar el QR rotativo del club (se mantiene).
- Cola offline de tokens rotativos en el celular del socio.
- Búsqueda manual por DNI en esta iteración (puede agregarse después).
- Cambiar el schema de `check_ins` a `TIMESTAMPTZ` (fuera de alcance).

---

## 1. Product model

| Actor | Flujo |
|---|---|
| Socio con datos | Escanea QR rotativo del portero → `POST /api/check-in` (igual que hoy) |
| Socio sin datos | Muestra QR fijo del carnet (app offline o captura) → portero escanea → `POST /api/check-in/by-member` |

Mensaje UX en carnet (corto): indicar que conviene abrir el carnet con internet antes de salir / guardar captura del QR.

---

## 2. Member QR payload

**Format (string inside QR):**

```text
estelares:m:<member_id>:<sig>
```

- `member_id`: UUID del socio.
- `sig`: primeros 10 hex de `HMAC-SHA256(QR_SECRET, "m:" + member_id)`.
- Reutilizar `QR_SECRET` existente (mismo secret que el QR rotativo). Si en el futuro se quiere rotar secretos de carnet por separado, se puede introducir `MEMBER_QR_SECRET` sin cambiar el formato.

**Validation (server):**
1. Parse prefix `estelares:m:`.
2. Split `member_id` + `sig`.
3. Recompute HMAC; compare en tiempo constante (`crypto.timingSafeEqual` sobre buffers de igual largo).
4. Reject if malformed or signature mismatch → `400` “QR inválido”.

**Security notes:**
- No poner solo el UUID en el QR (aunque sea difícil de adivinar); la firma evita forjar códigos.
- El QR es **estable** en el tiempo → apto para captura de pantalla.
- Comprometer `QR_SECRET` permitiría forjar carnets y tokens rotativos; rotación de secret implica re-login / regenerar QRs (aceptable a escala club).

---

## 3. Backend API

### `POST /api/check-in/by-member`

- **Auth:** `authMiddleware` + `requireRole('admin', 'portero')`.
- **Body:** `{ payload: string }` (contenido crudo del QR) **o** `{ memberId, sig }` — preferir `{ payload }` para un solo campo desde el scanner.
- **Steps:**
  1. Validar firma del payload.
  2. Verificar `members.activo` para ese id.
  3. `INSERT INTO check_ins (member_id, token_used) VALUES ($1, $2) ON CONFLICT DO NOTHING`.
     - `token_used`: `'p' + sig` (11 chars; cabe en `VARCHAR(20)`). Distingue ingresos portero vs token rotativo.
  4. Si `rowCount = 0` → `409` “Ya registró ingreso hoy”.
  5. Success → `200` `{ ok: true, member: { nombre, apellido, patente } }` (mismo shape útil que el check-in de socio para UI).

### Shared helpers

- `src/utils/memberQr.ts`: `buildMemberQrPayload(memberId)`, `parseAndVerifyMemberQr(payload)`.
- Reutilizar lógica de insert / conflicto del check-in actual donde sea razonable (sin over-abstracting).

### Existing endpoints

- `POST /api/check-in` — sin cambios de contrato.
- `GET /api/check-in/today`, `/today-status`, `/api/admin/stats` — sin cambios (ya usan día Argentina alineado al índice).

---

## 4. Frontend

### Carnet (`Carnet.tsx`)

- Incluir `id` en el tipo de usuario cacheado (`AuthUser`) si falta tipado.
- Generar QR en cliente con librería `qrcode` (ya usada en backend; agregar dependencia en `frontend` **o** pedir data-URL a un endpoint autenticado).
  - **Decisión:** generar en **cliente** a partir de payload firmado.
  - El payload firmado debe venir del **servidor** (el cliente no tiene `QR_SECRET`).
  - Por lo tanto: `GET /api/auth/me` (o endpoint dedicado `GET /api/auth/member-qr`) incluye `member_qr: "estelares:m:..."`; el cliente renderiza ese string a imagen QR y lo cachea en `localStorage` junto al user.
- Hint de texto bajo el QR (captura / abrir en casa).
- Offline: si `member_qr` está en cache, mostrar QR sin red.

### Portero (`Portero.tsx`)

- Mantener QR rotativo + lista de ingresos.
- Agregar modo **“Escanear socio”**:
  - Cámara + `jsQR` (mismo patrón que `CheckIn.tsx`).
  - Al detectar payload `estelares:m:...`, llamar `api.checkInByMember(payload)`.
  - Feedback: éxito (nombre), ya ingresó, error.
  - Volver al modo QR del club al cerrar el scanner.

### API client

- `api.checkInByMember(payload: string)`.

---

## 5. Hardening (opción A)

Alcance práctico en Express + Postgres pool. **No** incluye WAF/Cloudflare.

### Rate limiting (`express-rate-limit`)

| Limitador | Scope | Guía inicial |
|---|---|---|
| Global `/api/*` | Todas las rutas API | ~120 req / min / IP |
| Auth login | Ya existe (20 / 15 min) — mantener o alinear | Sin aflojar |
| Check-in writes | `POST /api/check-in`, `POST /api/check-in/by-member` | ~30 / min / IP |

- `app.set('trust proxy', 1)` ya está (Railway) — necesario para IP correcta.
- Excluir `GET /api/health` del limit global (healthchecks de Railway).

### Pool / DB

En `Pool` config:
- `max`: p.ej. 10 (hobby Railway).
- `connectionTimeoutMillis`: 5000.
- `idleTimeoutMillis`: 30000.
- `statement_timeout` vía `options: '-c statement_timeout=5000'` o `SET` en connect — evita queries colgadas saturen el pool.

### Request hygiene

- Mantener `express.json({ limit: '100kb' })`.
- Mantener `helmet` + error handler sin stack al cliente.
- Validar tipos/presence de body en endpoints de escritura (reject early 400).

### Out of scope (documentado)

- Cloudflare / rate limit en el edge.
- CAPTCHA.
- Migración a `TIMESTAMPTZ`.
- Auditoría de backups / secret rotation playbook completo.

---

## 6. Error handling & UX

| Caso | HTTP | Mensaje (ES) |
|---|---|---|
| Payload malformado / firma mala | 400 | QR inválido |
| Socio inactivo | 403 | Cuenta desactivada |
| Ya check-in hoy | 409 | Ya registró ingreso hoy |
| Rate limit | 429 | Demasiados intentos, esperá un momento |
| Error DB | 500 | Error al registrar el ingreso |

Portero UI: estados success / already / error análogos al CheckIn del socio.

---

## 7. Testing / verification

Manual:
1. Login socio online → carnet muestra QR → captura de pantalla.
2. Airplane mode → carnet (PWA/cache) o captura sigue usable.
3. Portero escanea → aparece en “Ingresos hoy”; segundo scan → 409.
4. Socio con datos sigue ingresando con QR rotativo.
5. Payload con firma alterada → 400.
6. Burst de requests a `/api/check-in` → 429.
7. Healthcheck `/api/health` no rate-limiteado de forma que tumbe el deploy.

---

## 8. Rollout

1. Deploy backend+frontend juntos (payload en `/me` + UI carnet + portero + limits).
2. Avisar a Pilo: abrir carnet en casa / captura; portero usa “Escanear socio” si no hay datos.
3. Observar Railway HTTP logs: `POST /api/check-in/by-member` y contadores.

## 9. Implementation order

1. `memberQr` utils + `POST /check-in/by-member` + `member_qr` en `/me`.
2. Rate limits + pool timeouts.
3. Frontend carnet QR + cache.
4. Frontend portero scanner mode.
5. Smoke test manual / deploy.
