# QR en Carnet + Scanner en Portero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir check-in offline para jugadores: el carnet muestra un QR con su member_id (cacheado en localStorage), el portero lo escanea y registra el ingreso desde su dispositivo con internet.

**Architecture:** 2 endpoints nuevos en el backend (GET /carnet/qr y POST /check-in/by-member), 2 nuevas funciones en api.ts, QR display en Carnet.tsx con cache localStorage, y modo scanner con jsQR en Portero.tsx. Todo el flujo actual (portero muestra QR, jugador escanea) queda intacto.

**Tech Stack:** Express/TypeScript (backend), React/TypeScript/Tailwind (frontend), `qrcode` (ya en backend), `jsQR` (ya en frontend)

---

### Task 1: Backend — GET /carnet/qr y POST /check-in/by-member

**Files:**
- Modify: `src/routes/checkin.ts` — agregar POST /by-member
- Modify: `src/routes/portero.ts` — agregar GET /carnet/qr (o crear `src/routes/carnet.ts`)
- Modify: `src/index.ts` (o el archivo principal de rutas) — registrar nueva ruta si se crea archivo nuevo

- [ ] **Step 1: Agregar GET /carnet/qr en `src/routes/portero.ts`**

Abrir `src/routes/portero.ts` y agregar antes del `export default router`:

```ts
router.get('/carnet-qr', authMiddleware, requireRole('member'), async (req, res) => {
  const memberId = req.user!.id;
  const qrDataUrl = await QRCode.toDataURL(memberId, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
  res.json({ qr: qrDataUrl });
});
```

> Nota: se agrega en `portero.ts` porque ya importa `QRCode` y el middleware. La ruta queda como `GET /api/portero/carnet-qr`. Si preferís separar en `carnet.ts`, hay que registrar la ruta en el servidor principal.

- [ ] **Step 2: Agregar POST /check-in/by-member en `src/routes/checkin.ts`**

Abrir `src/routes/checkin.ts` y agregar antes del `export default router`:

```ts
router.post('/by-member', authMiddleware, requireRole('admin', 'portero'), async (req, res) => {
  const { member_id } = req.body;

  if (!member_id || typeof member_id !== 'string') {
    res.status(400).json({ error: 'member_id requerido' });
    return;
  }

  const { rows: memberRows } = await pool.query(
    'SELECT id, nombre, apellido, activo FROM members WHERE id = $1',
    [member_id]
  );

  if (!memberRows[0]) {
    res.status(404).json({ error: 'Jugador no encontrado' });
    return;
  }

  if (!memberRows[0].activo) {
    res.status(403).json({ error: 'Jugador inactivo' });
    return;
  }

  const today = todayArgentina();
  const { rows: existingRows } = await pool.query(
    `SELECT id FROM check_ins WHERE member_id = $1 AND DATE(checked_in_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = $2`,
    [member_id, today]
  );

  if (existingRows.length > 0) {
    res.json({ ok: true, member: { nombre: memberRows[0].nombre, apellido: memberRows[0].apellido }, already: true });
    return;
  }

  await pool.query(
    'INSERT INTO check_ins (member_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [member_id]
  );

  res.json({ ok: true, member: { nombre: memberRows[0].nombre, apellido: memberRows[0].apellido }, already: false });
});
```

- [ ] **Step 3: Verificar que el servidor compila y arranca**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend
npx ts-node src/index.ts 2>&1 | head -20
```

O verificar con el comando de build del proyecto (revisar `package.json` para el script correcto).

- [ ] **Step 4: Commit**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend
git add src/routes/checkin.ts src/routes/portero.ts
git commit -m "feat: endpoints GET /carnet-qr y POST /check-in/by-member"
```

---

### Task 2: Frontend — api.ts + Carnet.tsx con QR cacheado

**Files:**
- Modify: `frontend/src/lib/api.ts` — 2 nuevas funciones
- Modify: `frontend/src/pages/Carnet.tsx` — QR display con cache localStorage

- [ ] **Step 1: Agregar funciones en api.ts**

En `frontend/src/lib/api.ts`, dentro del objeto `api`, agregar después de `getPorteroQr`:

```ts
  getCarnetQr: () =>
    request<{ qr: string }>('/portero/carnet-qr'),

  checkInByMember: (member_id: string) =>
    request<{ ok: boolean; member: { nombre: string; apellido: string }; already: boolean }>(
      '/check-in/by-member',
      { method: 'POST', body: JSON.stringify({ member_id }) }
    ),
```

- [ ] **Step 2: Agregar estado y lógica de QR en Carnet.tsx**

Abrir `frontend/src/pages/Carnet.tsx`. El componente `Carnet` ya tiene `user` del `useAuth()`. El `user.id` es el member ID.

Agregar estado para el QR justo después de la línea `const [status, setStatus] = useState<TodayStatus | null>(mock?.status ?? null);`:

```tsx
const [qrDataUrl, setQrDataUrl] = useState<string | null>(() => {
  if (mock || !user?.id) return null;
  return localStorage.getItem(`qr_cache_${user.id}`);
});
```

- [ ] **Step 3: Agregar efecto para fetchear y cachear el QR**

Agregar después del `useEffect` existente (el de `todayStatus`):

```tsx
useEffect(() => {
  if (mock || !user?.id) return;
  api.getCarnetQr()
    .then(({ qr }) => {
      setQrDataUrl(qr);
      localStorage.setItem(`qr_cache_${user.id}`, qr);
    })
    .catch(() => {
      // offline — usa cache si existe, ya cargado en el estado inicial
    });
}, [mock, user?.id]);
```

- [ ] **Step 4: Agregar la sección QR en el JSX del carnet**

En `Carnet.tsx`, buscar el cierre del card (`{/* FOOTER */}`) — la sección del QR va FUERA del card principal, debajo del mismo, antes del `{!mock && <OfflineBanner />}`.

Agregar entre `</div>` del card y `{!mock && <OfflineBanner />}`:

```tsx
{!mock && (
  <div className="w-full max-w-sm mt-4 rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '0.55s', backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
    <div className="px-5 py-4 flex flex-col items-center gap-3">
      <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--brand-accent)' }}>
        Mostrá este código al portero
      </p>
      {qrDataUrl ? (
        <div className="rounded-xl overflow-hidden p-3 bg-white">
          <img src={qrDataUrl} alt="QR personal" className="w-44 h-44 block" />
        </div>
      ) : (
        <div className="w-44 h-44 rounded-xl animate-pulse flex items-center justify-center" style={{ backgroundColor: 'var(--brand-surface-2)' }}>
          <p className="text-[10px] text-center px-4" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.5)' }}>
            Conectate para cargar tu QR
          </p>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: Verificar en browser**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend/frontend
npm run dev
```

Abrir `/carnet`. Verificar:
1. Se muestra el QR debajo del carnet.
2. Recargar sin internet (DevTools → Network → Offline): el QR sigue mostrándose desde cache.
3. Si nunca se cargó con conexión, muestra el placeholder "Conectate para cargar tu QR".

- [ ] **Step 6: Commit**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend
git add frontend/src/lib/api.ts frontend/src/pages/Carnet.tsx
git commit -m "feat: QR personal en carnet con cache offline en localStorage"
```

---

### Task 3: Frontend — modo scanner en Portero.tsx

**Files:**
- Modify: `frontend/src/pages/Portero.tsx`

- [ ] **Step 1: Leer el archivo Portero.tsx para entender la estructura actual**

Leer `frontend/src/pages/Portero.tsx` completamente antes de modificar.

- [ ] **Step 2: Agregar estado para el modo scanner**

Dentro del componente principal de `Portero.tsx`, agregar estados:

```tsx
const [scanMode, setScanMode] = useState(false);
const [scanResult, setScanResult] = useState<{ ok: boolean; member: { nombre: string; apellido: string }; already: boolean } | null>(null);
const [scanError, setScanError] = useState<string | null>(null);
const [scanning, setScanning] = useState(false);
const videoRef = useRef<HTMLVideoElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
const streamRef = useRef<MediaStream | null>(null);
const animFrameRef = useRef<number>(0);
```

Asegurarse que `useRef` ya está importado. Si no, agregarlo al import de React.

- [ ] **Step 3: Agregar funciones del scanner**

Agregar estas funciones dentro del componente:

```tsx
const startScanner = async () => {
  setScanMode(true);
  setScanResult(null);
  setScanError(null);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    scanFrame();
  } catch {
    setScanError('No se pudo acceder a la cámara');
  }
};

const stopScanner = () => {
  cancelAnimationFrame(animFrameRef.current);
  streamRef.current?.getTracks().forEach(t => t.stop());
  streamRef.current = null;
  setScanMode(false);
  setScanResult(null);
  setScanError(null);
  setScanning(false);
};

const scanFrame = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;
  if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
    animFrameRef.current = requestAnimationFrame(scanFrame);
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // jsQR must be imported at top of file
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (code && /^[0-9a-f-]{36}$/i.test(code.data) && !scanning) {
    setScanning(true);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    api.checkInByMember(code.data)
      .then(result => {
        setScanResult(result);
        setScanning(false);
        setTimeout(() => stopScanner(), result.already ? 2000 : 2500);
      })
      .catch((err: Error) => {
        setScanError(err.message || 'Error al registrar ingreso');
        setScanning(false);
      });
    return;
  }
  animFrameRef.current = requestAnimationFrame(scanFrame);
};
```

- [ ] **Step 4: Agregar import de jsQR**

Al tope de `Portero.tsx`, agregar:

```tsx
import jsQR from 'jsqr';
```

Y agregar import de `api` si no está ya importado.

- [ ] **Step 5: Agregar el botón "Escanear jugador" en el JSX**

Buscar en el JSX del portero donde se muestra el QR rotativo (probablemente hay un botón o área de controles). Agregar un botón junto a esa área:

```tsx
<button
  onClick={startScanner}
  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all active:scale-95"
  style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.1)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.25)', color: 'var(--brand-accent)' }}
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5V16M4 16v.5M4 20h4m12 0h.01M4 4h4m12 0h.01M4 8h.01M20 8h.01" />
  </svg>
  Escanear jugador
</button>
```

- [ ] **Step 6: Agregar el overlay/modal del scanner en el JSX**

Agregar al final del JSX del componente (antes del `return` closing), un overlay fullscreen que aparece cuando `scanMode === true`:

```tsx
{scanMode && (
  <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#000' }}>
    {/* Cámara */}
    <video ref={videoRef} className="flex-1 object-cover w-full" playsInline muted />
    <canvas ref={canvasRef} className="hidden" />

    {/* Overlay de feedback */}
    {(scanResult || scanError || scanning) && (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-2xl px-8 py-6 flex flex-col items-center gap-3 mx-6 text-center"
          style={scanResult?.already
            ? { backgroundColor: 'rgb(217 119 6 / 0.95)' }
            : scanResult
            ? { backgroundColor: 'rgb(22 163 74 / 0.95)' }
            : scanError
            ? { backgroundColor: 'rgb(220 38 38 / 0.95)' }
            : { backgroundColor: 'rgb(0 0 0 / 0.85)' }
          }
        >
          {scanning && !scanResult && !scanError && (
            <p className="text-white text-sm font-semibold">Procesando…</p>
          )}
          {scanResult && (
            <>
              <p className="text-white text-2xl font-bold">
                {scanResult.member.apellido}, {scanResult.member.nombre}
              </p>
              <p className="text-white text-sm font-semibold tracking-wider uppercase">
                {scanResult.already ? 'Ya ingresó hoy' : '✓ Ingreso registrado'}
              </p>
            </>
          )}
          {scanError && (
            <p className="text-white text-sm font-semibold">{scanError}</p>
          )}
        </div>
      </div>
    )}

    {/* Guía de escaneo */}
    {!scanResult && !scanError && !scanning && (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-56 h-56 border-2 border-white rounded-2xl opacity-60" />
      </div>
    )}

    {/* Botón cancelar */}
    <div className="absolute top-5 right-5">
      <button
        onClick={stopScanner}
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    {/* Label inferior */}
    {!scanResult && !scanError && (
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Apuntá al QR del jugador
        </p>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Verificar en browser**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend/frontend
npm run dev
```

Abrir `/portero`. Verificar:
1. Botón "Escanear jugador" visible junto al QR rotativo.
2. Al presionar, abre cámara en fullscreen con guía de escaneo.
3. Botón ✕ cierra el scanner.
4. (Opcional con dispositivo real) Escanear el QR del carnet registra el ingreso y muestra nombre en verde.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend
git add frontend/src/pages/Portero.tsx
git commit -m "feat: modo scanner de jugadores en portero con jsQR"
```
