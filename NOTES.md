# NOTES.md — Historial y estado del proyecto (tech.gsocd.com)

Reglas de proceso -> ver WORKFLOW.md (léelo primero). Aquí vive el historial
de features, bugs, decisiones y pendientes, en orden cronológico.

**Si este archivo supera ~600 líneas**, es hora de resumir entradas viejas
(más de ~3 semanas sin tocarse) a un párrafo o moverlas a NOTES_ARCHIVE.md,
en vez de seguir apilando sin límite.

## SUBIDO (23/09/2026): descripción del servicio en tooltip

gsocd-shared v1.50.0 (`service-tooltip` + picker). get-catalog.js manda
`description` (Sales Description de QuickBooks). employee.html pide el
catálogo en paralelo con get-my-orders y lo registra antes de pintar
(si falla, la lista sale igual); nombres de servicio con tooltip en las
listas por servicio y por lugar. supervisor.html: picker v1.50.0.

## SUBIDO (23/09/2026, tarde): órdenes por lugar se reconocen por recurrente + Assign by service

Con los edificios de Admin, un cliente de un solo nivel se lee
"Restroom" a secas, así que el regex "Floor N / …" ya no alcanza.
get-my-orders.js ahora manda `RecurringServiceID`; `isPlaceOrder()` =
AssignByService + RecurringServiceID (regex de respaldo).
submit-service-complete.js solo acepta `placeMode` en esas órdenes.

## SUBIDO (23/09/2026): recurrentes "Who does what" -- Mark as Done por LUGAR + extras

Contraparte de Admingsocd.com (ver su NOTES.md, misma fecha). Las órdenes
recurrentes por lugar traen el lugar ("Floor 1 / Hallway") en Category de
cada servicio. employee.html las detecta (`isPlaceOrder`, regex PLACE_RE)
y las pinta agrupadas por lugar con UN Mark as Done por lugar + su cámara:
mismo flujo real de camera-capture (foto obligatoria), usando el lugar
como serviceName de la foto (`svc-<lugar>-...`) y submit-service-complete
con `placeMode` (marca 'Pending Review' todos los servicios de ESE técnico
en ese lugar). Órdenes normales: sin cambios.

Botón "The client asked for something not on my list" (solo en estas
órdenes): `submit-extra-request.js` (nuevo, registrado en el router) deja
un evento 'Extra Requested' interno en OrderHistory; oficina lo aprueba o
rechaza desde Active. OJO: `async function` dentro del bloque `if (tech)`
NO se vuelve global sola (las `function` normales sí) -- por eso
`window.sendExtraRequest`.

## Proyecto grande (15/09/2026): cámara propia + cola offline real

Ver `gsocd-shared/NOTES.md` para el contexto completo (origen real: un
técnico perdió ~7 de 8 fotos en un punto muerto conocido; por qué
`camera-capture.html` vive por dominio y no en shared; los 9 puntos
totales en los 3 repos). Aquí solo lo que le tocó a **Tech
específicamente** -- este fue el PRIMER repo conectado, y el único cuya
cámara en sí ya se probó de verdad en producción y quedó confirmada por
el dueño.

- 3 puntos de captura, en `employee.html` Y `supervisor.html` (código
  duplicado entre los dos, cada cambio se hizo 2 veces):
  1. **Take a photo** -- navega directo a `camera-capture.html`.
  2. **Mark as Completed** -- foto obligatoria antes de completar.
     `camera-capture.html` soporta `requireAtLeastOne=1` (el botón Done
     no deja salir con 0 fotos) y `completeAfter=1` (al terminar, regresa
     con `?completeOrder=<id>` en la URL; `employee.html`/
     `supervisor.html` detectan ese parámetro al cargar y llaman
     `finishCompletion(orderId)` solas, sin que el técnico tenga que
     darle clic 2 veces).
  3. **Foto de Recurring** (opcional) -- contexto `recurring-photo`,
     mismo `camera-capture.html`, sube a `/upload-recurring-photo`.
- **Video se queda con la cámara nativa** (`camera-input`, el botón
  aparte "Record a video") -- se le agregó un botón nuevo separado
  porque antes "Take a photo" y video compartían el mismo `<input>`
  nativo; ahora foto pasa por la cámara propia y video sigue como
  estaba, así que necesitaban 2 botones distintos.
- Se quitó `#recurring-camera-input` y su listener por completo (ya sin
  uso, las fotos de recurring pasan por la cámara nueva).
- **Efecto secundario real, solo en `supervisor.html`:** hay 2 paneles
  de "Update Services" (uno para órdenes normales, otro para Recurring)
  con edición viva en memoria. Como la cámara nueva navega fuera de la
  página por completo, se agregó `saveSupervisorEditSnapshot()`/
  `restoreSupervisorEditSnapshotIfAny()` -- mismo patrón de snapshot en
  `sessionStorage` que se usó en Admin. El panel de Recurring usa un
  `GSServicePicker` real montado (`rcUpdatePicker`) -- hacía falta volver
  `async` toda la cadena de montaje (`toggleRcUpdate` ya no se llamaba
  sin esperar) para poder pisarle la selección con `setSelected()` al
  restaurar. `employee.html` NO tiene este riesgo -- no hay ningún panel
  de edición ahí, se confirmó explícitamente antes de decidir que no
  hacía falta protegerlo.

