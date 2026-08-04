# Design: Ingreso por carnet (flujo único) + hardening API

**Date:** 2026-08-03  
**Status:** Product decision = **A** (solo portero escanea); UX = pulido, calmo, moderno  
**Goal:** Un solo ritual de ingreso. El socio muestra el QR del carnet; el portero escanea. Sin preguntar “¿quién escanea?”. Endurecer el backend contra abuso básico de API (opción A).

## Context

- El portero siempre tiene internet; los socios a menudo no.
- Dos flujos en paralelo confunden en la puerta.
- Ideal: el socio abre el carnet en casa (o guarda captura del QR fijo) y en la cancha solo lo muestra.
- Ya existe corrección de timezone para “ingresos hoy”.

## Non-goals

- Flujo dual / QR rotativo del club como camino de ingreso diario.
- Mitigación DDoS en el borde (Cloudflare) — mejora futura.
- Búsqueda manual por DNI en esta iteración.
- Cola offline de tokens rotativos.
- Migración a `TIMESTAMPTZ`.

---

## 1. Product model (flujo único)

**Ritual:** socio muestra carnet (app o captura) → portero apunta → confirmación breve → listo.

| Actor | Acción |
|---|---|
| Socio | Abre carnet (idealmente en casa) / guarda captura del QR fijo. En la puerta **solo muestra**. |
| Portero | Pantalla siempre lista para escanear. No elige “modo”. |

- El QR rotativo del club **deja de ser el ingreso**. Se puede dejar el endpoint `/api/portero/qr` sin UI, o retirarlo en el mismo PR si no lo usa nadie más.
- Ruta `/check-in` del socio (escanear QR del club) **sale del flujo principal**: quitar CTA “ESCANEAR QR” del carnet; redirigir o mostrar mensaje corto “Mostrá este carnet al portero” si alguien entra a `/check-in` con bookmark viejo.

---

## 2. UX principles (pulido, no torpe)

- **Una composición, un trabajo:** Portero = escanear + ver últimos ingresos. Carnet = identidad + QR para mostrar.
- **Sin ruido:** nada de toggles “Escanear socio / QR club”, pills, badges flotantes, ni textos largos.
- **Feedback cinematográfico corto:** éxito ~1.2–1.8s a pantalla completa suave, luego vuelve solo al visor. Sin modales de confirmación.
- **Motion con intención (2–3):** (1) línea/marco de escaneo sutil en idle, (2) flash/confirmación de ingreso, (3) entrada del nuevo item en la lista.
- **Marca:** tipografía display existente (`Bebas Neue` / `font-display`), paleta brand actual (tema activo del club). El QR es blanco sobre superficie oscura o bloque claro contenido — alto contraste, no sticker flotante.
- **Accesible en cola:** targets grandes, texto mínimo, legible de noche.

---

## 3. Pantalla Portero (rediseño)

### Layout (mobile-first, tablet listo)

```
┌─────────────────────────────┐
│  Estelares · Portero   Salir│
│                             │
│     ┌─────────────────┐     │
│     │                 │     │
│     │   VIEWFINDER    │     │  ← cámara full-bleed en el bloque
│     │   (siempre on)  │     │
│     │                 │     │
│     └─────────────────┘     │
│        Ingresos  12         │  ← un número, tipografía display
│                             │
│   Últimos                   │
│   · Nombre Apellido  21:04  │
│   · …                       │
└─────────────────────────────┘
```

### Estados del viewfinder (sin “modos”)

| Estado | Qué se ve |
|---|---|
| **Idle / buscando** | Cámara + marco fino + hint de una línea: “Apuntá al carnet”. Scan-line suave (ya existe animación). |
| **Leyendo** | Breve hold (evitar doble submit); sin spinner agresivo. |
| **Éxito** | Overlay full del bloque: nombre grande + “INGRESÓ”, acento brand, haptic/vibra si disponible. Auto-dismiss ~1.5s → idle. |
| **Ya ingresó** | Mismo lenguaje visual pero tono muted / “YA ESTABA”. Auto-dismiss. |
| **Error** | “QR no válido” / “Cuenta inactiva” — corto, auto-dismiss. |

### Detalles de interacción

- Un solo `processingRef` / lock: un scan a la vez.
- Tras éxito, reiniciar detección limpia (no re-leer el mismo frame en loop).
- Lista “Últimos” con flash suave en el nuevo (reusar `animate-gold-flash` o equivalente calmado).
- Contador “Ingresos” con count-up existente.
- **No** mostrar countdown ni QR rotativo.

---

## 4. Pantalla Carnet (socio)

### Qué cambia

- El carnet gana un **bloque QR fijo** como pieza clara de “mostrar en la puerta” — debajo de los datos / status, integrado al card (no tarjeta aparte ruidosa).
- Quitar botón **ESCANEAR QR** (flujo viejo).
- Status:
  - No ingresado: texto calmado tipo “Mostrá tu QR al portero” (no CTA de cámara).
  - Ingresado: mantener “INGRESADO HOY” + hora.
- Hint de una línea (muted): “Podés guardar una captura si no vas a tener datos.”
- Offline banner existente se mantiene.

### Generación del QR

- `/api/auth/me` incluye `member_qr: "estelares:m:<id>:<sig>"`.
- Cliente renderiza con `qrcode` (dep en frontend) y cachea `member_qr` en `estelares_user` para offline.
- QR alto contraste, margen generoso, tamaño cómodo para escanear a ~30–50 cm.

---

## 5. Member QR payload

```text
estelares:m:<member_id>:<sig>
```

- `sig` = primeros 10 hex de `HMAC-SHA256(QR_SECRET, "m:" + member_id)`.
- Validación server: parse + `timingSafeEqual`.
- Fijo en el tiempo → apto para captura.

---

## 6. Backend API

### `POST /api/check-in/by-member`

- Auth: `admin` | `portero`.
- Body: `{ payload: string }`.
- Validar firma → socio activo → `INSERT ... ON CONFLICT DO NOTHING`.
- `token_used`: `'p' + sig` (≤ 20 chars).
- Responses: 200 + member / 409 ya hoy / 400 inválido / 403 inactivo / 500.

### Helpers

- `src/utils/memberQr.ts`: `buildMemberQrPayload`, `parseAndVerifyMemberQr`.

### Legacy

- `POST /api/check-in` (socio + token rotativo): **deprecar en UI**; endpoint puede quedar un release por compatibilidad o eliminarse si `/check-in` ya no lo llama. Preferencia: **dejar endpoint** por un deploy, **quitar UI**; cleanup en follow-up si no hay tráfico.
- `GET /api/portero/qr`: sin UI; cleanup follow-up.

---

## 7. Hardening (opción A)

| Medida | Detalle |
|---|---|
| Rate limit global `/api/*` | ~120 req/min/IP; excluir `GET /api/health` |
| Rate limit login | Mantener el actual |
| Rate limit check-in writes | ~30/min/IP en `POST /check-in` y `/check-in/by-member` |
| Pool PG | `max` ~10, `connectionTimeoutMillis` 5s, `statement_timeout` ~5s |
| Body | Seguir con `json` 100kb; validar presence/tipo en writes |
| Helmet + error handler | Mantener |

Fuera de alcance: Cloudflare, CAPTCHA, rotación formal de secretos.

---

## 8. Verification

1. Carnet online → QR visible → captura.
2. Airplane mode → carnet/caché o captura usable.
3. Portero escanea → overlay éxito → figura en lista y contador.
4. Segundo scan mismo día → “YA ESTABA”.
5. Payload alterado → error corto.
6. No hay QR rotativo ni CTA “escanear” en carnet.
7. Burst API → 429; healthcheck OK para Railway.

---

## 9. Implementation order

1. `memberQr` utils + `member_qr` en `/me` + `POST /check-in/by-member`.
2. Rate limits + pool timeouts.
3. Carnet: QR + quitar CTA viejo + copy.
4. Portero: rediseño viewfinder-first (retirar QR rotativo de UI).
5. Soft-landing `/check-in` legacy.
6. Smoke + deploy.
