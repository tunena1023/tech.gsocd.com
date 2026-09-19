# NOTES.md — Cómo se trabaja en este proyecto

Este archivo existe para que cualquier chat de Claude (u otra persona) que entre
a este repo después no tenga que adivinar el proceso, ni repetir preguntas ya
resueltas, ni subir cosas sin permiso. Léelo completo antes de tocar código.

## Reglas de trabajo con el dueño del proyecto

1. **Nada se sube al repo sin permiso explícito.** El dueño dice cómo quiere
   que algo funcione (el resultado, no el código línea por línea). Quien
   programa se inventa la forma técnica de lograrlo, pero antes de tocar el
   repo real, regresa y explica: "encontré esto, funciona así, ¿le entro?" —
   sobre todo si hay una decisión de por medio (crear una columna nueva,
   elegir entre 2 formas de resolverlo, etc.). Solo con un "dale"/"súbelo"
   explícito se sube. Sin excepción, aunque el fix se vea obvio.

2. **No asumas silenciosamente.** Si algo es ambiguo, o si el código actual
   sugiere un mecanismo distinto al que el dueño describe, se pregunta o se
   verifica ANTES de decidir por cuenta propia. Leer el código para entender
   cómo funciona hoy está bien y se espera — pero eso no reemplaza confirmar
   qué se quiere que pase.

3. **"Minis" antes de tocar UI/visual.** Para cualquier cambio visual o de
   comportamiento de interfaz, se arma una vista previa interactiva (HTML
   autocontenido, publicado como artifact) ANTES de tocar el repo real. Si
   el cambio usa un componente de `gsocd-shared`, el mini debe inyectar el
   componente REAL (el archivo tal cual, no una reconstrucción) para que lo
   que se prueba sea exactamente el comportamiento real, no una simulación.

4. **Los cambios se pueden acumular en local sin subir.** El dueño puede
   pedir varios cambios seguidos y decir "no subas nada todavía" — en ese
   caso los cambios se hacen sobre copias locales (en el sandbox de la
   sesión) y se van apilando, hasta que se den todos juntos con un solo
   "dale". Cuando esto pase, quien retome la conversación (aunque sea otra
   sesión) debe saber que puede haber cambios locales sin commitear — si el
   dueño menciona algo que "quedó pendiente" y no aparece en el repo, no es
   un error, probablemente sigue en el sandbox de la sesión anterior sin
   subir. Pregúntale directo si quiere que se rehaga o si ya se perdió.

5. **Cada commit debe explicar el porqué, no solo el qué.** El mensaje de
   commit tiene que ser lo bastante específico para que una sesión nueva
   entienda el contexto completo sin tener que re-investigar: qué problema
   real se encontró, por qué se eligió esa solución y no otra, y si hay
   trade-offs o casos que se dejaron fuera a propósito.

6. **El tono del dueño es directo y con groserías — no es un ataque
   personal, es como habla.** Se puede hablar de igual a igual, con más
   soltura de la que se usaría normalmente, sin necesidad de ser cortante
   ni de disculparse en exceso. Dicho eso: no hay que auto-insultarse ni
   quedarse callado si algo cruza a un insulto directo — se puede reconocer
   el error real sin necesidad de repetir el insulto.

7. **Antes de subir CUALQUIER cambio al repo (aunque ya esté "confirmado" y
   listo para el commit), hay que revisarlo de punta a punta como si fuera
   un caso real** — seguir el flujo completo, paso a paso, desde que algo
   se crea/pide hasta que se completa/cierra, buscando específicamente: dos
   flujos que puedan pisarse o duplicarse, un dato que se pierda en el
   camino entre una pantalla y otra, una pantalla que no se entere de un
   cambio que hizo otra, y campos usados en el código que no coincidan con
   lo documentado como columnas necesarias en SharePoint. Esto no es
   opcional ni solo para features grandes — es el último paso antes de
   cualquier "dale", cada vez. En esta sesión, esta revisión encontró 7
   bugs reales que el código "ya terminado" traía escondidos — ninguno era
   un error de sintaxis (esos ya se habían validado con `node --check`),
   todos eran de lógica: cosas que se ven perfectas archivo por archivo
   pero fallan en la costura entre dos archivos.

## Mapa de la arquitectura (para no perderse)

**4 repos, todos de `tunena1023` en GitHub, cada uno su propio proyecto en
Vercel (equipo "GS Solutions"):**

| Repo | Dominio | Para quién | Notas |
|---|---|---|---|
| `tech.gsocd.com` | tech.gsocd.com | Empleados/supervisores en campo | Login por QR + DeviceToken (sin password). Nunca se crean órdenes aquí. |
| `Admingsocd.com` | admin.gsocd.com | Oficina/staff | Aprobar órdenes, catálogo de servicios, scheduling |
| `ordersgsocd.com` | orders.gsocd.com | Clientes | Pedir servicio, tracking, portal de cliente |
| `gsocd-shared` | — (no se despliega) | — | Componentes de UI reutilizados por los 3 portales, vía jsDelivr + git tags |

**Cómo se consume `gsocd-shared`:** cada componente se referencia en el HTML
con una URL fija a una versión (`https://cdn.jsdelivr.net/gh/tunena1023/
gsocd-shared@vX.X.X/nombre-componente/archivo.js`). Los tags son de TODO el
repo (no por componente), así que subir un fix implica: 1) editar el archivo
en `main`, 2) crear un tag nuevo (`git/refs` con `refs/tags/vX.X.X` apuntando
al commit), 3) actualizar el `<script src>` en cada HTML que lo usa a la
versión nueva. Sin el paso 3, el fix vive en el repo pero nadie lo usa
todavía — cada consumidor está pegado a la versión que tenga escrita.

**El catálogo de servicios tiene 2 listas de SharePoint, NO conectadas entre
sí por el sistema — son fuentes independientes, a propósito:**
- **`ServicesCatalog`** — SKUs importados de QuickBooks (Division,
  PropertyType, Price, ServiceName se sobreescriben en cada import). El
  campo `Category` es la ÚNICA excepción: el import nunca la toca, se
  mantiene a mano desde `developer.html` > tab "Services" (botón junto a
  cada renglón). Esta es la lista real que alimenta el selector de
  servicios en TODO lugar donde se pone o edita una orden.
- **`Services`** — lista vieja, migrada de un Excel el 30/08/2026. Ya no es
  la fuente real para nada activo del selector de servicios nuevo (ver
  historial de conversación del 10/09/2026 para el porqué se descartó como
  fuente — quedó documentado ahí que mezclar las 2 listas fue un error).

**El selector de servicios compartido (`gsocd-shared/service-picker`)**
tiene una opción `groupByCategory: true` que agrupa por `Category` en un
acordeón (categorías sin asignar caen en "Uncategorized", nunca se pierden).
Por regla del dueño (confirmada 10/09/2026): este acordeón es el estándar
en TODO lugar de Admin u Orders donde se pone o edita una orden — no
aplica a Tech (ahí nunca se crean órdenes). Los 5 lugares reales hoy (verificado
contra el código, 15/09/2026): `appr-` (Approvals > Update) en Admin,
`create-order` en Admin, `customer-order` en Orders, más `tpl-admin` (Admin)
y `template-editor` (Orders) para plantillas.

**Excepción confirmada:** Active (`admin.html`) YA NO usa este acordeón para
editar servicios de una orden en curso -- el rediseño del 15/09/2026 lo
reemplazó por una lista editable en línea (X/undo por servicio, pills
L1/L2/L3 para Janitorial), sin categorías. El código viejo que montaba el
acordeón ahí (`buildServiceRows`/`mountAdminServicePicker`/
`buildAdminLegacyNote`) se dejó de llamar en ese rediseño pero no se borró
hasta ahora (15/09/2026) -- quedó como código muerto que hacía parecer que
Active seguía usando el acordeón cuando ya no era cierto. Se confirmó con
el dueño que no hace falta reactivarlo, y se borró por completo.

## Cómo conectarse (para que una sesión nueva no tenga que preguntar)

**Vercel:** ya está disponible como conector en Claude -- no requiere token,
solo usar las herramientas Vercel: list_teams / list_projects / get_project
etc. Team: "GS Solutions" (team_JW18RqqLyzjaO9nYs4NWVAVA).

**GitHub:** NO hay conector instalado en Claude -- no existe, no hay que
buscarlo dos veces. La unica forma de acceso es que el dueño pegue un
Personal Access Token (fine-grained, scope: Contents Read/Write + Metadata
Read, limitado a los 3 repos de tunena1023) directo en el chat. Con ese
token se clonan los repos por HTTPS (`git clone https://<token>@github.com/
tunena1023/<repo>.git`). El token NO se guarda entre sesiones -- se pide
uno nuevo cada vez, y el dueño lo revoca al terminar.

Repos: tunena1023/Admingsocd.com, tunena1023/tech.gsocd.com,
tunena1023/ordersgsocd.com.


## Regla reforzada (12/09/2026): nunca tocar codigo en produccion directo

Todo cambio de codigo se hace SIEMPRE sobre la copia local del repo (el
sandbox de la sesion), nunca hay edicion directa a lo ya desplegado. El
commit + push (que dispara el deploy en Vercel) SOLO pasa cuando el dueño
lo autoriza explicitamente para ESE cambio puntual -- una autorizacion
general de "asi trabajamos" no cuenta como luz verde para subir algo
especifico. Si el dueño pide varios ajustes seguidos, se acumulan en
local (ver regla 4 de arriba) hasta que diga que los suba.

## Regla nueva (19/09/2026): probar en un Preview de Vercel ANTES de pedir el "dale" a main -- no solo prometer que se probo

Motivo: una sesion anterior subio cambios directo a main sin permiso del
dueno (violando la regla de arriba), y otra dejo un bug real sin poder
probarlo de verdad antes de subirlo. Esto reemplaza "confio en que
funciona" por una forma de que el dueno lo vea funcionando de verdad,
en su propio celular, con datos reales, ANTES de que exista la
posibilidad de tocar produccion:

1. Cualquier cambio que vaya a subirse (no solo visual -- ver regla 3
   para el mini de UI, este paso es el que sigue DESPUES de eso, al
   tocar el repo real) se hace en una rama nueva creada desde
   `origin/main`, nunca commiteando directo a main. Nombre descriptivo,
   ej. `fix/services-requested-mobile-cards`.
2. Se hace `git push` de esa rama (con el token de GitHub). Vercel
   arma automaticamente un deployment de Preview para esa rama -- no
   hace falta configurar nada, es automatico en este proyecto (equipo
   "GS Solutions" en Vercel).
3. Para conseguir el link real del Preview (no adivinarlo): usar las
   herramientas de Vercel (`list_deployments` filtrando por `branch` y
   `slug: "gs-solutions1"`, luego `get_deployment` hasta que
   `readyState` sea `READY`). El campo `alias` del deployment trae la
   URL estable tipo
   `<proyecto>-git-<rama-slug>-gs-solutions1.vercel.app` -- ESA es la
   que se le manda al dueno, no la URL de un deployment individual
   (que cambia cada vez que se sube algo nuevo a la rama).
4. Esa URL alias NO cambia aunque se suban mas commits a la misma
   rama despues (para iterar un fix sin mandar un link nuevo cada
   vez) -- se le puede pedir al dueno que solo haga refresh.
5. Es el MISMO backend/datos reales que produccion (mismas
   SharePoint lists, mismo Graph), asi que el dueno puede probar con
   una orden real de verdad -- no es una simulacion.
6. Solo cuando el dueno prueba en ese link y dice explicitamente que
   se suba (ej. "dale", "subelo a produccion") se hace el merge de esa
   rama a `main` y el push a main (que es lo unico que de verdad toca
   orders.gsocd.com / admin.gsocd.com / tech.gsocd.com reales). Esto
   nunca se asume ni se hace por iniciativa propia, ni siquiera si el
   cambio "ya se probo y se ve bien" en el Preview -- ver la primera
   regla de este archivo.
7. Si algo sale mal despues de subir a la rama, se siguen iterando
   ahi (mas commits a la misma rama) -- production nunca se toca
   hasta que el dueno lo confirma, sin importar cuantas vueltas tome
   arreglarlo bien.


## Regla reforzada (12/09/2026): leer TODO este archivo antes de tocar nada

Antes de tocar codigo, revisar un bug, o proponer un cambio -- lo primero,
siempre, es leer este NOTES.md completo (los 3 repos, no solo el que se
va a tocar, porque comparten arquitectura y gsocd-shared). No asumir que
"ya se sabe" el contexto de sesiones anteriores sin haber leido esta
version actual del archivo -- puede haber pendientes, decisiones o
cambios en local sin subir que cambian por completo cual es la forma
correcta de resolver algo.

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

**Pendiente -- confirmado con el dueño, a propósito, NO es un olvido:**
los 2 paneles de "Update Services" de `supervisor.html` (el normal y el
de Recurring) siguen con su diseño viejo (un modal separado, sin las
mejoras que ya tiene Active en Admin). El dueño confirmó que quiere
rediseñarlos para que se vean como las tarjetas de Admin -- X/undo en
línea por servicio, pills de nivel L1/L2/L3, y un ícono de cámara POR
SERVICIO individual (no solo el botón general de la tarjeta) -- pero
pidió explícitamente dejar eso para una sesión aparte de diseño, y que
esta sesión solo se enfocara en que la edición actual (con el diseño
viejo tal cual está) no se perdiera al ir a la cámara. Cuando se haga
ese rediseño, la lógica de la cámara que ya existe en `camera-queue.js`
se reusa igual -- lo que cambia es solo cómo se ve el panel.

