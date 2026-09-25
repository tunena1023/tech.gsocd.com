# NOTES.md — Historial y estado del proyecto (tech.gsocd.com)

Reglas de proceso -> ver WORKFLOW.md (léelo primero). Aquí vive el historial
de features, bugs, decisiones y pendientes, en orden cronológico.

**Si este archivo supera ~600 líneas**, es hora de resumir entradas viejas
(más de ~3 semanas sin tocarse) a un párrafo o moverlas a NOTES_ARCHIVE.md,
en vez de seguir apilando sin límite.

## EN PREVIEW (25/09/2026): el servidor ya no le cree al navegador quién es el técnico

- Antes, cada función tomaba del body `techId`, `role`, `division` y `actor`
  (nombre). Cualquiera podía pedir `/api/get-my-orders` con el techId de otro, o
  mandar un Supervisor Update a nombre de un supervisor.
- `lib/tech-auth.js`: cookie firmada `gs_tech_auth` (HttpOnly, 30 días) con techId,
  rol, nombre y división leídos de la lista Techs. Se da en device-auth
  (activate-device, y verify-device cada vez que se abre la app), login-tech y
  register-tech. Clave: `TECH_SESSION_SECRET` en Vercel (una distinta en Production
  y en Preview; ya puesta el 25/09/2026).
- `api/[...slug].js`: sin cookie → 401 (`GS.api` regresa a index.html, que revalida
  el QR y renueva la cookie solo). Con cookie, techId/role/division/actor se
  escriben encima del body. Públicas: register-tech, login-tech, device-auth,
  site-image, get-catalog.
- Se quitó el "diagnóstico temporal" de verify-setup, que regresaba los ids de
  TODOS los técnicos a quien trajera un link malo.
- site-image: solo imágenes de la raíz. Antes se podía bajar cualquier archivo del
  SharePoint pasando una ruta.
- **Pendiente (decidir con el dueño):** cualquiera se puede auto-registrar y queda
  Active como Employee. El login viejo (nombre + últimos 4 del teléfono) no tiene
  freno de intentos. Opciones: registrarse como inactivo hasta que la oficina lo
  apruebe, y/o dejar solo el QR.

## SUBIDO A PRODUCCIÓN (25/09/2026): correos de notificación (reemplaza Power Automate)

**Así quedó Vercel (25/09/2026, final, los 3 proyectos):**
- **Producción:** `NOTIFY_MODE=live`, `NOTIFY_FROM=noreply@gsocd.com`. Los correos
  les llegan a los clientes de verdad (el dueño le pasa el portal al primer
  cliente real el 26/09/2026).
- **Preview:** `NOTIFY_MODE=test`, `NOTIFY_TEST_TO=CFO@gsocd.com`. SIEMPRE en test:
  Preview usa el mismo SharePoint que producción, así que tocar una orden real en
  un preview le mandaría un correo al cliente. En test, todo lo que sale de un
  preview le llega solo a CFO@ con `[TEST → destinatario real]` en el asunto.
  Nunca poner `live` en Preview.
- Si cambias una variable en Vercel, los deploys que ya existen no la ven: hay que
  volver a desplegar (y reasignar test-admin.gsocd.com si hace falta).
orders@ es un grupo: sus correos caen en las bandejas de CFO@, Admin@, Service@ y
customercare@, no tiene bandeja propia. La pantalla nueva de "Order received" en
customer.html también se subió el mismo día ("así mero", mini con el portal
real: https://claude.ai/artifact/LiBZziphN8DccD8W3g6D2s).

El envío vive en `lib/notify.js`, que es una COPIA de `gsocd-shared/lib/notify.js`
(mismo criterio que division-rules: Vercel no reinstala tags nuevos). Manda desde
orders@gsocd.com por Graph `sendMail`. La app GSPortal ya tiene `Mail.Send`
(Application) con admin consent (dueño, 25/09/2026). Vista previa aprobada:
https://claude.ai/artifact/2VhdVbEYgSsxDwRuvbTNbv

**Variables en Vercel (por proyecto, Admin + Orders + Tech):**
- `NOTIFY_MODE`: `off` (default, no sale nada) / `test` (todo a `NOTIFY_TEST_TO`,
  con el destinatario real en el asunto) / `live`. Preview usa el MISMO SharePoint
  que producción: probar SIEMPRE en `test`, nunca en `live`.
- `NOTIFY_TEST_TO`, `NOTIFY_OFFICE_TO` (default orders@gsocd.com, varios con coma).
- `NOTIFY_FROM=noreply@gsocd.com` (puesto en Vercel, 25/09/2026): el buzón
  COMPARTIDO "GS Solutions". orders@gsocd.com es un GRUPO de distribución y Graph
  no puede mandar desde un grupo ("The requested user 'orders@gsocd.com' is
  invalid", primera prueba real en Preview). Las respuestas de los clientes van
  a orders@ por Reply-To (`NOTIFY_REPLY_TO`, default orders@gsocd.com). Si se
  arma la Application Access Policy, el buzón que va en el grupo es noreply@.

**Lista opcional `NotificationLog`** (bitácora de cada intento; si no existe, se
ignora): Title, OrderID, Event, Recipient, Subject, Result (Sent/Skipped/Failed),
Detail, Mode. Todas de texto.

**Qué sale y de dónde:**
- Cliente. **Confirmations** salen SIEMPRE: "Send to client" (`admin-update-order` requestOnly) y
  pedir reactivación (`admin-approve-order`). **Changes**: fecha/ventana movida en una
  orden ya asignada (`admin-update-order` directo); decisiones del director
  (cancelación aprobada; rechazo solo si lo pidió el cliente; Reassign/Reschedule
  aplicados); orden reactivada. **Updates**: orden recibida (`submit-order` flujos
  A/C/D/E y `add-batch-unit` en Orders; un PO = 1 correo); programada (primera
  asignación, `Order Assigned`); Completed (con el PDF de completación adjunto si
  pesa menos de 2.8 MB).
- Oficina (`NOTIFY_OFFICE_TO`): orden nueva, edición, cambio, cancelación o nuevas
  fechas pedidas por el cliente; cliente confirmó cambio o reactivación; técnico
  marcó su orden o un servicio como hecho (por lugar de recurrente NO); formulario
  de contacto (Reply-To = quien escribió).
- Recuperar Client ID: siempre, sin el candado de "una vez en la vida"; freno de
  10 min entre correos al mismo email.
- Nunca sale: cambios internos (Supervisor, inspección, Office Change (Internal)),
  aprobación de orden nueva (ya salió "Scheduled"), técnico terminó (al cliente).
- A quién: contacto de la orden → contacto del edificio (se empareja por dirección
  y # de edificio, la orden no guarda el id) → contacto marcado "recibe
  notificaciones" → Clients.Contact → Orders.Email. Contactos Phone se saltan.

**Antes de `live`:** apagar los flows viejos de Power Automate sobre ContactMessages
e IdRecovery si existen (si no, correos dobles), y la Application Access Policy
para que GSPortal solo pueda mandar como orders@.

**No cubierto todavía:** modo "Assign by service" (cada servicio con su propia
fecha: no manda "Scheduled"), órdenes creadas desde Admin (`submit-order` de Admin
no manda "received"), SMS.

## SUBIDO (23/09/2026): checklist de paquetes para el técnico

get-catalog manda `areas` y `packageItems` (Settings). get-my-orders
agrega `PackageSnapshots` a las órdenes que traen paquete (la foto que
se guardó al crear la orden, `lib/package-contents.js`), y employee.html
muestra "Includes: …" con nivel bajo el paquete. supervisor.html: picker
v1.52.0 con el toggle (contrato recurrente → Recurring).

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

