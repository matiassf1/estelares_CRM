# QR en Carnet + Scanner en Portero — Design Spec

**Fecha:** 2026-08-17

## Objetivo

Permitir que los jugadores sin internet puedan hacer check-in mostrando el QR de su carnet, que el portero escanea desde su dispositivo (que sí tiene internet).

## Flujo

1. Jugador abre `/carnet` → ve su QR personal (cargado desde cache si no tiene internet)
2. Portero activa modo "Escanear jugador" en `/portero` → abre cámara
3. Cámara lee el QR del jugador (contiene `member_id`)
4. App del portero llama `POST /check-in/by-member` con el `member_id`
5. Backend registra el ingreso, portero ve confirmación con nombre del jugador

---

## Parte 1 — Backend: endpoint GET /carnet/qr

**Archivo:** `src/routes/carnet.ts` (nuevo) o agregar a `src/routes/checkin.ts`

- `GET /api/carnet/qr`
- Auth: `authMiddleware` + `requireRole('member')`
- Genera: `QRCode.toDataURL(member.id, { width: 300, margin: 2 })`
- Retorna: `{ qr: string }` (dataURL base64 PNG)
- El `member.id` viene del JWT decodificado (`req.user.id`)

---

## Parte 2 — Backend: endpoint POST /check-in/by-member

**Archivo:** `src/routes/checkin.ts`

- `POST /api/check-in/by-member`
- Auth: `authMiddleware` + `requireRole('portero')` (también acepta `admin`)
- Body: `{ member_id: string }`
- Valida: miembro existe y `activo === true`
- Inserta en `check_ins (member_id)` con `ON CONFLICT DO NOTHING`
- Retorna:
  - `{ ok: true, member: { nombre, apellido }, already: false }` — check-in nuevo
  - `{ ok: true, member: { nombre, apellido }, already: true }` — ya ingresó hoy
  - 404 si miembro no existe
  - 403 si miembro está inactivo

---

## Parte 3 — Frontend: api.ts (2 nuevas funciones)

```ts
getCarnetQr: () => request<{ qr: string }>('/carnet/qr'),
checkInByMember: (member_id: string) =>
  request<{ ok: boolean; member: { nombre: string; apellido: string }; already: boolean }>(
    '/check-in/by-member', { method: 'POST', body: JSON.stringify({ member_id }) }
  ),
```

---

## Parte 4 — Frontend: Carnet.tsx

**Nuevo comportamiento:**
- On mount: intentar cargar QR desde `localStorage` key `qr_cache_${user.id}` primero (render inmediato, sin esperar red)
- Luego fetchear `api.getCarnetQr()` en segundo plano
- Si fetch exitoso: actualizar imagen + guardar en `localStorage` (sobrescribe cache anterior)
- Si fetch falla y hay cache: usar cache silenciosamente
- Si fetch falla y no hay cache: mostrar mensaje "Conectate a internet para cargar tu QR"

**UI:**
- Sección nueva debajo de los datos del jugador con label "MOSTRÁ ESTE CÓDIGO AL PORTERO"
- `<img src={qrDataUrl} className="w-48 h-48 mx-auto rounded-xl" />`
- Fondo blanco detrás del QR (necesario para que la cámara lo lea correctamente)
- Si está cargando (sin cache aún): skeleton placeholder

---

## Parte 5 — Frontend: Portero.tsx

**Nuevo botón:** "ESCANEAR JUGADOR" en la UI del portero (junto al QR rotativo)

**Modo scanner:**
- Al activar: abre `getUserMedia({ video: { facingMode: 'environment' } })`
- Canvas oculto + loop de `jsQR` a ~8fps (mismo patrón que `CheckIn.tsx`)
- Al detectar un string que parece UUID (regex `/^[0-9a-f-]{36}$/i`): llama `api.checkInByMember(memberId)`
- Mientras procesa: muestra spinner, pausa el scanner
- **Éxito (already: false):** overlay verde con nombre del jugador + "INGRESO REGISTRADO", cierra scanner tras 2.5s
- **Duplicado (already: true):** overlay amarillo "YA INGRESÓ HOY" + nombre, cierra tras 2s
- **Error 403 (inactivo):** overlay rojo "JUGADOR INACTIVO"
- **Error 404:** overlay rojo "JUGADOR NO ENCONTRADO"
- Botón "✕ Cancelar" para cerrar scanner manualmente

**No cambia:** el QR rotativo del portero y el flujo de check-in actual siguen igual — este es un modo adicional.

---

## Sin cambios en

- `CheckIn.tsx` — flujo de check-in del jugador sin cambios
- Auth, JWT, roles — sin cambios
- Base de datos — misma tabla `check_ins`, misma constraint de unicidad diaria
