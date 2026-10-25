# Rediseño del panel de administración — Estelares

**Fecha:** 2026-10-24
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Problema

El panel actual muestra *datos*; el administrador tiene que encontrar solo el *trabajo*.

Cuatro carencias, todas confirmadas contra el código y contra la base de producción:

1. **No hay pantalla de inicio.** Al entrar se cae directamente en una tabla de 108 jugadores.
2. **Toda acción vive en el menú `⋮` de una fila.** Nada es masivo: resolver 10 membresías son 10 aperturas.
3. **No hay configuración.** Usuarios, contraseñas, horarios de entrenamiento y datos del club no tienen dónde vivir. La contraseña del admin sólo se cambia por variable de entorno.
4. **Nada está segregado.** Operación diaria, administración y análisis conviven en el mismo nivel.

### Hallazgos de producción que motivan el diseño

| Dato | Valor | Consecuencia |
|---|---|---|
| Activos sin venir hace +21 días | **28 de 98 (29%)** | Ninguna pantalla lo informa hoy |
| `training_schedules` | **0 filas** | `attendance_pct` y `sessions_expected` devuelven vacío en toda Analítica |
| `parking_spots` | **0 filas** | La sección Parking ocupa navegación sin datos |
| Activos sin foto | **25** | El portero no puede validarlos visualmente |
| Membresías a revisar | **10** | Migradas sin motivo registrado |
| Categoría C13 | sin actividad desde **14/08** | Parada hace más de dos meses, sin alerta |

El origen de (2) es que la UI de carga de horarios está enterrada dentro del detalle de categoría en Analítica, aunque el endpoint `/api/admin/training-schedules` y el modelo ya existen y funcionan. **La carencia de configuración es la causa directa de la carencia de información.**

---

## 2. Decisiones tomadas

| # | Decisión |
|---|---|
| D1 | Navegación de un solo nivel: `Inicio · Jugadores · Club · Analítica · Config` |
| D2 | Inicio = bandeja de pendientes arriba + categorías compactas abajo |
| D3 | Categorías, horarios y cocheras se agrupan bajo **Club** |
| D4 | **Tema único** negro/blanco/dorado. Se elimina el tema `clasico` y el toggle |
| D5 | **La foto del jugador siempre tiene prioridad** — ya es el comportamiento actual y no cambia. Lo único que cambia es el fallback cuando no hay foto: iniciales sobre gris sobrio, en lugar de siete colores por hash del nombre |
| D6 | Reglas de negocio configurables quedan **fuera de alcance** (ver §7) |

---

## 3. Sistema visual

Tema único, colapsado en `:root`. Valores actuales del bloque `[data-theme="escudo"]`.

```
#000000  fondo            #0C0C0C  superficie       #181818  superficie 2
#E8E8E8  primario · acción (texto negro encima)
#C9A84C  dorado · atención
#909090  gris · bordes    #5A5A5A  apagado          #F5F5F0  texto
#f87171  peligro          #3FB56B  activo / ok
```

**Jerarquía semántica, en tres niveles:**

- **Blanco** — acción primaria. «Hacé esto.»
- **Dorado** — atención sin urgencia: suspendidos, filtros activos, pendientes. «Mirá esto.»
- **Rojo** — sólo peligro: baja, categoría parada, jugadores descolgados. «Esto está mal.»

Tipografía, grano y líneas diagonales a -55° se conservan sin cambios (Bebas Neue + Inter).

### Limpieza que habilita el tema único

- Colapsar el bloque `[data-theme="escudo"]` en `:root` y borrar el bloque `clasico`.
- Borrar las **10 reglas `[data-theme=...]`** de `index.css`, incluidas:
  ```css
  [data-theme="escudo"] button[style*="brand-primary"] { color:#000 !important; }
  ```
  que matchea por substring del atributo `style` inline. Se reemplaza por el token `--brand-on-primary: #000`, aplicado explícitamente donde corresponde.
- Borrar `hooks/useTheme.ts` y `components/ThemeToggle.tsx` (**ya es código muerto**: `ThemeToggle` no se renderiza en ningún lado).
- Quitar la llamada `useTheme()` de `App.tsx:94` y fijar el atributo en el HTML, o eliminarlo por completo al no haber variantes.
- Borrar `avatarColor()` de `Admin.tsx:45` y `CategoryDetailView.tsx:22` (**duplicada**); el fallback pasa a iniciales sobre gris.

---

## 4. Pantallas

### 4.1 Inicio

**Bloque «Para resolver»** — tarjetas accionables, cada una navega a la vista ya filtrada:

| Tarjeta | Color | Fuente del dato |
|---|---|---|
| N se descolgaron | rojo | activos con último check-in > 21 días |
| N membresías a revisar | dorado | `member_membership_state.needs_review` |
| N sin foto de carnet | dorado | activos con `foto_url IS NULL` |
| N horarios cargados | dorado | `training_schedules` vigentes |

**Si no hay pendientes, el bloque entero no se renderiza.** No se muestran ceros: el panel arranca con el pulso del club y una línea de «todo al día».

**Bloque «El club»** — activos, suspendidos (en dorado), ingresos 7d, jugadores 7d.

**Bloque «Categorías»** — las 11, ordenadas por necesidad de atención: rojo si no registran hace más de 21 días, dorado si hace más de 7, neutro si están al día.

**Atajos** — + Jugador (blanco), QR del portero (dorado), Ingreso manual.

### 4.2 Jugadores

- **Filtros combinables**: estado, categoría, actividad, foto. Se combinan entre sí; hoy los chips son mutuamente excluyentes.
- **Selección por checkbox**, con selección total en la cabecera.
- **Barra de acciones masivas** pegada abajo, visible sólo con selección: Reactivar · Suspender con motivo · Dar de baja · Cambiar categoría.
- Una confirmación para el grupo, un motivo compartido, y **todas las operaciones del lote en una sola transacción**.
- El menú `⋮` por fila se conserva para las acciones individuales (editar, historial, cochera).

### 4.3 Club

Tres sub-vistas: **Categorías** (lo actual), **Horarios** (nuevo) y **Cocheras**.

**Horarios** es la pieza de mayor retorno: tabla de categorías con sus días y horas, alta y edición. Backend ya existente. Al cargarlos se enciende el control de asistencia de Analítica, hoy inerte.

**Cocheras** conserva la funcionalidad actual sin cambios, con un estado vacío que explica para qué sirve la sección. Queda una **decisión pendiente del club**: si no se usa estacionamiento asignado, eliminar la sección es menos código que mantenerla. No se toma en este diseño.

### 4.4 Config

- **Usuarios**: alta, rol, cambio de contraseña desde la UI.
- **Datos del club**: nombre, escudo.
- **Catálogos**: motivos de suspensión y de baja (hoy hardcodeados en `MembershipSheet.tsx`).
- **Reglas de membresía**: visibles en **sólo lectura**, con la leyenda de que se vuelven editables cuando exista un segundo club.

### 4.5 Mobile

Las 5 secciones entran en la barra inferior sin submenús — la razón concreta por la que se eligió navegación de un nivel. La barra de acciones masivas se adapta a dos botones.

---

## 5. Arquitectura frontend

`Admin.tsx` tiene **846 líneas** con jugadores, categorías y parking inline. Partirlo es condición para lo demás:

```
pages/admin/
  AdminLayout.tsx      nav, topbar, routing entre secciones
  InicioPage.tsx       pendientes + pulso + categorías
  JugadoresPage.tsx    filtros, selección, acciones masivas
  ClubPage.tsx         categorías | horarios | cocheras
  ConfigPage.tsx       usuarios | club | catálogos | reglas
```

Componentes nuevos, cada uno con una responsabilidad:

- `PendingCard` — tarjeta accionable del Inicio
- `BulkActionBar` — barra de acciones masivas
- `FilterBar` — filtros combinables
- `ScheduleEditor` — alta y edición de horarios

Se reutilizan sin cambios: `ActionMenu`, `BottomSheet`, `ConfirmModal`, `InfoPanel`, `Toast`, `MembershipBadge`, `MembershipSheet`, `MembershipTimeline`, `PlayerEditPanel`.

### Backend

Mayormente ya existe. Agregados:

- `GET /api/admin/dashboard` — un solo endpoint con los contadores del Inicio, para no encadenar cinco llamadas al abrir.
- `POST /api/admin/members/bulk/{suspend|terminate|reactivate}` — recibe una lista de ids y un motivo; **una transacción para todo el lote**, con un registro de auditoría por jugador. Reutiliza el servicio `membership.ts` existente.
- Usuarios: CRUD nuevo sobre la tabla `admins` existente (alta, rol, cambio de contraseña).
- Catálogos: tabla nueva `catalog_items (id, tipo, valor, orden)`, donde `tipo` ∈ `{motivo_suspension, motivo_baja}`. Migración aditiva, sembrada con los valores hoy hardcodeados en `MembershipSheet.tsx`.

---

## 6. Testing

- **Integración (PostgreSQL real)**: el endpoint de dashboard devuelve los contadores correctos; las operaciones masivas son atómicas —si una falla, no se aplica ninguna—; cada jugador del lote queda auditado; un lote con un id inválido no corrompe el resto.
- **Regresión**: las operaciones individuales existentes siguen funcionando (los 72 tests actuales deben seguir verdes).
- **Visual**: con el tema único, ninguna pantalla queda con texto blanco sobre fondo blanco al eliminar los hacks de `[data-theme]`.

---

## 7. Fuera de alcance

**Reglas de negocio configurables** (retroactividad, si la suspensión libera cochera, si el suspendido ingresa, duración máxima).

Hoy viven en un solo servicio y están cubiertas por tests. Hacerlas configurables implica una tabla de configuración, cargarla en cada transición y multiplicar los casos de prueba por cada combinación. Para **un** club cuyas reglas no cambian el beneficio es nulo; para el SaaS multi-club es imprescindible.

**Se construye cuando aparezca el segundo club.** El servicio queda preparado para recibir la configuración sin reescribirse: las constantes ya están centralizadas en `membership.ts`.

---

## 8. Orden de implementación

| # | Pieza | Por qué en ese lugar |
|---|---|---|
| 1 | Tema único + partir `Admin.tsx` + navegación | Marco donde cae todo lo demás; la limpieza de tema es pura resta |
| 2 | Inicio | La pantalla que no existe; mayor impacto percibido |
| 3 | Horarios de entrenamiento | Mayor retorno sobre esfuerzo: backend listo, enciende Analítica entera |
| 4 | Jugadores: filtros + acciones masivas | La queja más concreta; backend casi listo |
| 5 | Config | Necesario y acotado, pero no desbloquea nada más |

---

## 9. Criterios de aceptación

- [ ] Al abrir el panel se ve el estado del club y el trabajo pendiente, sin scrollear, en mobile y escritorio
- [ ] Resolver las 10 membresías en revisión toma **dos acciones**, no diez
- [ ] Los horarios de entrenamiento se cargan desde Club, y Analítica empieza a reportar asistencia
- [ ] La contraseña del admin se cambia desde la UI
- [ ] Existe un solo tema; no queda ninguna regla `[data-theme]` ni el selector por substring de `style`
- [ ] La foto del jugador se muestra siempre que exista; el fallback es gris sobrio
- [ ] Sin pendientes, el bloque «Para resolver» no se renderiza
- [ ] Los 72 tests de integración siguen verdes

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Partir `Admin.tsx` (846 líneas) puede romper comportamiento existente | Mover sin reescribir primero; los cambios de diseño van en un commit aparte |
| Eliminar el tema `clasico` deja texto ilegible donde los hacks compensaban | Revisión visual de cada pantalla; el token `--brand-on-primary` reemplaza al hack |
| Las acciones masivas pueden aplicar una operación a quien no corresponde | Confirmación que enumera los jugadores afectados; una sola transacción |
| El endpoint de dashboard agrega carga en cada apertura | Son conteos sobre tablas chicas (108 filas); medir antes de cachear |
