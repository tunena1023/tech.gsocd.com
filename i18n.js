/* ============================================================
   i18n.js -- ENG / ESP para el portal de tecnicos (25/09/2026,
   pedido del dueño: "los tecnicos quieren una opcion en espanol").

   Como funciona: las pantallas se siguen escribiendo en ingles. Este
   archivo traduce lo que ya se pinto (texto, placeholder, title) con
   un diccionario de frases EXACTAS + unos patrones con numeros, y un
   MutationObserver traduce lo que se pinta despues (tarjetas, avisos).
   alert/confirm/prompt tambien pasan por aqui. Nombres de clientes y
   direcciones NO se tocan.

   Servicios, categorias y areas del catalogo: los traduce Google del
   lado del servidor (/api/get-es-terms, se guardan en
   ServicesCatalog.ServiceNameES) y llegan aqui como diccionario extra
   (DYN), guardado en el telefono. Fechas: toLocale* con 'en-US' pasa
   a 'es-MX'.

   El idioma de cada quien: Techs.Language en SharePoint (se guarda al
   cambiarlo, /api/save-tech-language) y una copia en el telefono
   (localStorage) para la pantalla de entrada, antes de saber quien es.
   Cambiar de idioma recarga la pagina.
============================================================ */
(function () {
  var KEY = 'gs_tech_lang';

  var ES = {
    /* --- navegacion / generales --- */
    'Tech Portal': 'Portal de técnicos',
    'Active Orders': 'Órdenes activas',
    'Recurring': 'Recurrentes',
    'History': 'Historial',
    'Gallery': 'Galería',
    'Sign out': 'Cerrar sesión',
    'Sign in': 'Entrar',
    'Sign In': 'Entrar',
    'Signing in…': 'Entrando…',
    'Loading…': 'Cargando…',
    'Loading history…': 'Cargando historial…',
    'Cancel': 'Cancelar',
    'Close': 'Cerrar',
    'Done': 'Listo',
    'Undo': 'Deshacer',
    'All': 'Todas',
    'Today': 'Hoy',
    'In 1 day': 'En 1 día',
    'Save changes': 'Guardar cambios',
    'Nothing was changed.': 'No se cambió nada.',
    'Something\'s not right': 'Algo no está bien',
    'Hi,': 'Hola,',

    /* --- divisiones (fijas; Google diria "Conserjeria") --- */
    'Janitorial': 'Limpieza',
    'Renovations': 'Renovaciones',
    'Mixed': 'Mixto',

    /* --- entrada / registro / telefono --- */
    'Sign in with your name and the last 4 digits of your phone.': 'Entra con tu nombre y los últimos 4 dígitos de tu teléfono.',
    'First Name': 'Nombre',
    'Last Name': 'Apellido',
    'Last 4 digits of your phone': 'Últimos 4 dígitos de tu teléfono',
    'Phone Number': 'Teléfono',
    'Email': 'Correo',
    'New here?': '¿Eres nuevo?',
    'Create an account': 'Crear una cuenta',
    'Create Account': 'Crear cuenta',
    'Create Your Account': 'Crea tu cuenta',
    'Creating account…': 'Creando cuenta…',
    'Already registered?': '¿Ya tienes cuenta?',
    'Please fill in all fields.': 'Llena todos los campos.',
    'Please fill in your name and 4 phone digits.': 'Escribe tu nombre y los 4 dígitos de tu teléfono.',
    'Checking this phone…': 'Revisando este teléfono…',
    'Checking your link…': 'Revisando tu enlace…',
    'Setting up…': 'Configurando…',
    'Taking you to your orders…': 'Abriendo tus órdenes…',
    'You\'re all set': 'Todo listo',
    'Confirm — This Is Me': 'Confirmar — Soy yo',
    'Tap below to set up this phone. You\'ll only need to do this once — after that, this icon will take you straight to your orders.': 'Toca abajo para configurar este teléfono. Solo se hace una vez; después, este ícono te lleva directo a tus órdenes.',
    'Tap below to set up this phone. When it asks about notifications, tap Allow — that\'s how you get your job alerts. You\'ll only need to do this once.': 'Toca abajo para configurar este teléfono. Cuando te pregunte por notificaciones, toca Permitir: así te llegan los avisos de tus trabajos. Solo se hace una vez.',
    'First, add the app to this iPhone\'s home screen:': 'Primero, agrega la app a la pantalla de inicio de este iPhone:',
    'Tap the Share button (square with an arrow ↑) at the bottom of Safari.': 'Toca el botón Compartir (cuadro con flecha ↑) abajo en Safari.',
    'Tap "Add to Home Screen", then "Add".': 'Toca "Agregar a inicio" y luego "Agregar".',
    'Close Safari and open GS Tech from the new icon to finish.': 'Cierra Safari y abre GS Tech desde el ícono nuevo para terminar.',
    '🔔 Job alerts are on.': '🔔 Avisos de trabajo activados.',
    '🔕 Job alerts are off on this phone. Ask the office to help you turn on notifications.': '🔕 Los avisos están apagados en este teléfono. Pide a la oficina que te ayude a activar las notificaciones.',
    'You\'ll use your name and phone digits to sign in from now on.': 'De ahora en adelante vas a entrar con tu nombre y los dígitos de tu teléfono.',
    'This link is missing information. Please ask the office for a new QR code.': 'A este enlace le falta información. Pide a la oficina un código QR nuevo.',
    'e.g. (515) 555-4021': 'ej. (515) 555-4021',
    'e.g. 4021': 'ej. 4021',

    "Contractors don't have access to the tech app. Please contact the office.": 'Los contratistas no tienen acceso a la app de técnicos. Comunícate con la oficina.',
    'Account created': 'Cuenta creada',
    'Your account is waiting for the office to approve it. Once they do, sign in with your name and the last 4 digits of your phone.': 'Tu cuenta está esperando a que la oficina la apruebe. Cuando la aprueben, entra con tu nombre y los últimos 4 dígitos de tu teléfono.',
    'Back to sign in': 'Volver a entrar',
    'This account is inactive. Please contact the office.': 'Esta cuenta no está activa. Comunícate con la oficina.',
    'Too many tries. Please wait an hour or ask the office for help.': 'Demasiados intentos. Espera una hora o pide ayuda a la oficina.',

    /* --- tarjetas de orden --- */
    'Order': 'Orden',
    'Entry': 'Entrada',
    'Due': 'Fecha límite',
    'Service Window': 'Horario',
    'Service window': 'Horario',
    'Service Date': 'Fecha de servicio',
    'Division': 'División',
    'Address': 'Dirección',
    'Building': 'Edificio',
    'Unit': 'Unidad',
    'Bed / Bath': 'Recámaras / Baños',
    'Contact': 'Contacto',
    'Supervisor': 'Supervisor',
    'Developer': 'Developer',
    'Exteriors': 'Exteriores',
    '📷 Add a photo (optional)': '📷 Agregar una foto (opcional)',
    'Add a photo (optional)': 'Agregar una foto (opcional)',
    'Commercial': 'Comercial',
    'Level': 'Nivel',
    'Level 1': 'Nivel 1',
    'Level 2': 'Nivel 2',
    'Level 3': 'Nivel 3',
    'Qty': 'Cant.',
    'Completed': 'Completado',
    'Pending Review': 'En revisión',
    'Not Started': 'Sin empezar',
    'Waiting on office': 'Esperando a la oficina',
    /* --- orden en espera (26/09/2026) --- */
    'Waiting on client': 'Esperando al cliente',
    'Inspection sent to the office': 'Inspección enviada a la oficina',
    'The office will schedule the work. You can still add photos.': 'La oficina va a programar el trabajo. Todavía puedes subir fotos.',
    'Cancellation requested': 'Cancelación pedida',
    'The office is reviewing it. Do not start new work on this order. You can still add photos.': 'La oficina lo está revisando. No empieces trabajo nuevo en esta orden. Todavía puedes subir fotos.',
    'Waiting on the client': 'Esperando al cliente',
    'The office sent a change for the client to confirm. You can still add photos.': 'La oficina le mandó un cambio al cliente para que lo confirme. Todavía puedes subir fotos.',
    'Service update sent to the office': 'Cambio de servicios enviado a la oficina',
    'You can keep adding photos and send more service changes while you wait.': 'Mientras esperas, puedes seguir subiendo fotos y mandar más cambios de servicios.',
    'Unit not ready was reported': 'Se reportó que la unidad no está lista',
    'The office will decide what happens next. You can still add photos.': 'La oficina va a decidir qué sigue. Todavía puedes subir fotos.',
    'The client asked for a change': 'El cliente pidió un cambio',
    'The office is reviewing it. See the history below. You can still add photos.': 'La oficina lo está revisando. Mira el historial abajo. Todavía puedes subir fotos.',
    'The office is reviewing a change': 'La oficina está revisando un cambio',
    'See the history below. You can still add photos.': 'Mira el historial abajo. Todavía puedes subir fotos.',
    /* --- historial (etiquetas de gsocd-shared/order-history) --- */
    'Order created': 'Orden creada',
    'Assigned': 'Asignada',
    'Change requested': 'Cambio pedido',
    'Change approved': 'Cambio aprobado',
    'Change not approved': 'Cambio no aprobado',
    'Change request withdrawn': 'Solicitud de cambio retirada',
    'New dates requested': 'Fechas nuevas pedidas',
    'Services change requested': 'Cambio de servicios pedido',
    'Service change requested': 'Cambio de servicio pedido',
    'Services updated': 'Servicios actualizados',
    'Schedule confirmed': 'Horario confirmado',
    'Rescheduling in progress': 'Reprogramando',
    'Order cancelled': 'Orden cancelada',
    'Cancellation not approved': 'Cancelación no aprobada',
    'Tech marked their work done': 'El técnico marcó su trabajo como terminado',
    'Inspection scheduled': 'Inspección programada',
    'Inspection done': 'Inspección terminada',
    'Service scheduled': 'Servicio programado',
    'Service completed': 'Servicio completado',
    'No history.': 'Sin historial.',
    'Added': 'Agregado',
    'No services on this order.': 'Esta orden no tiene servicios.',
    'No services recorded.': 'No hay servicios registrados.',
    'Search by order number or client…': 'Buscar por número de orden o cliente…',
    'No orders match that search.': 'Ninguna orden coincide con la búsqueda.',
    'No active orders assigned to you right now.': 'Ahorita no tienes órdenes activas asignadas.',
    'No active orders in your department right now.': 'Ahorita no hay órdenes activas en tu departamento.',
    'Orders scheduled to you. Only orders assigned with your name show up here.': 'Órdenes programadas para ti. Aquí solo salen las que están asignadas a tu nombre.',
    'All active orders in your department — approved and already scheduled.': 'Todas las órdenes activas de tu departamento, aprobadas y ya programadas.',
    'All active orders across every division — approved and already scheduled.': 'Todas las órdenes activas de todas las divisiones, aprobadas y ya programadas.',
    'Not scheduled yet': 'Sin programar',

    /* --- acciones --- */
    '📷 Take a photo for this order': '📷 Tomar una foto para esta orden',
    '🎥 Record a video': '🎥 Grabar un video',
    'Add a photo for this service': 'Agregar una foto para este servicio',
    'Add a photo of this place': 'Agregar una foto de este lugar',
    'Photo saved to this order.': 'Foto guardada en esta orden.',
    'Video saved to this order.': 'Video guardado en esta orden.',
    'Videos must be 5 minutes or less — please record a shorter one.': 'Los videos deben durar 5 minutos o menos. Graba uno más corto.',
    'Take at least 1 photo before finishing.': 'Toma al menos 1 foto antes de terminar.',
    '✓ Mark as Done': '✓ Marcar como terminado',
    'Mark as Done': 'Marcar como terminado',
    'Mark as done': 'Marcar como terminado',
    'marked done': 'marcado como terminado',
    'Marked done — the office will confirm and close it.': 'Marcado como terminado; la oficina lo confirma y lo cierra.',
    '✓ Marked done — waiting for the office to confirm and close it.': '✓ Marcado como terminado; esperando que la oficina lo confirme y lo cierre.',
    '✓ You marked this as done — waiting for the office to confirm and close it.': '✓ Marcaste esto como terminado; esperando que la oficina lo confirme y lo cierre.',
    'Update Services': 'Actualizar servicios',
    'Report: Unit Not Ready': 'Reportar: unidad no lista',
    'Why is the unit not ready?': '¿Por qué no está lista la unidad?',
    'Reported. Our office will review it.': 'Reportado. La oficina lo va a revisar.',
    'Send to Office': 'Enviar a la oficina',
    'Send to office': 'Enviar a la oficina',
    'Sent to the office for review.': 'Enviado a la oficina para revisión.',
    'Sent to the office. Wait for approval before doing it.': 'Enviado a la oficina. Espera la aprobación antes de hacerlo.',
    'This goes to the office for review — the client won\'t see it until GS Solutions sends it.': 'Esto va a la oficina para revisión; el cliente no lo ve hasta que GS Solutions se lo mande.',
    'Remove service': 'Quitar servicio',
    'Confirm Remove': 'Confirmar quitar',
    'Please add a note.': 'Agrega una nota.',
    'Please add a note explaining why.': 'Agrega una nota explicando por qué.',
    'Please add a short note explaining why.': 'Agrega una nota corta explicando por qué.',
    'Speak instead of typing': 'Dictar en vez de escribir',
    '💡 On iPhone: tap the microphone icon on your keyboard to dictate this note.': '💡 En iPhone: toca el micrófono del teclado para dictar la nota.',
    'Search the catalog...': 'Buscar en el catálogo...',
    'Search the catalog…': 'Buscar en el catálogo…',
    'No matching services.': 'No hay servicios que coincidan.',
    'No changes yet.': 'Todavía no hay cambios.',
    'An order needs at least one service — remove fewer, or add one before sending.': 'Una orden necesita al menos un servicio. Quita menos, o agrega uno antes de enviar.',
    'The client asked for something not on my list': 'El cliente pidió algo que no está en mi lista',
    'What did the client ask for?': '¿Qué pidió el cliente?',
    'A change for this visit is already waiting on the office.': 'Ya hay un cambio para esta visita esperando a la oficina.',
    'e.g. Clean the 2nd floor conference room': 'ej. Limpiar la sala de juntas del 2º piso',
    'e.g. Client confirmed this area does not need service this visit': 'ej. El cliente confirmó que esta área no necesita servicio esta visita',
    'Could not open the camera — check that you gave permission, then reload this page.': 'No se pudo abrir la cámara. Revisa que diste permiso y recarga la página.',
    'Could not read that file — please try again.': 'No se pudo leer el archivo. Intenta de nuevo.',
    'Camera': 'Cámara',
    '0 / 10 photos': '0 / 10 fotos',

    /* --- documentos --- */
    'Docs': 'Documentos',
    'Documents from your orders (PDF, Word, text). The office and the client add them.': 'Documentos de tus órdenes (PDF, Word, texto). Los suben la oficina y el cliente.',
    'No documents yet.': 'Todavía no hay documentos.',
    'No documents match that search.': 'Ningún documento coincide con la búsqueda.',
    'Search by order, client or file name…': 'Buscar por orden, cliente o nombre de archivo…',
    'View': 'Ver',
    'Download': 'Descargar',
    'Opening…': 'Abriendo…',
    "This file can't be shown here.": 'Este archivo no se puede mostrar aquí.',
    'Use Download to open it on your device.': 'Usa Descargar para abrirlo en tu teléfono.',
    'GS Solutions': 'GS Solutions',

    /* --- inspeccion --- */
    'Inspection': 'Inspección',
    '📷 Take inspection photos': '📷 Tomar fotos de inspección',
    'What did you find?': '¿Qué encontraste?',
    'Notes about the visit (the client can see these)…': 'Notas de la visita (el cliente las puede ver)…',
    'Who should do the work?': '¿Quién debe hacer el trabajo?',
    'No crew available in your department.': 'No hay personal disponible en tu departamento.',
    '✓ Inspection done': '✓ Inspección terminada',
    'Edit service changes': 'Editar cambios de servicios',
    'Saved with this inspection — the office reviews it when you tap Inspection done.': 'Se guarda con esta inspección; la oficina lo revisa cuando toques Inspección terminada.',
    'Changes saved. They go to the office when you finish the inspection.': 'Cambios guardados. Se mandan a la oficina cuando termines la inspección.',
    'Finish this inspection? The office will review it before the work is scheduled.': '¿Terminar esta inspección? La oficina la revisa antes de programar el trabajo.',
    'Inspection sent to the office.': 'Inspección enviada a la oficina.',
    'Inspection sent. The office will review your service changes.': 'Inspección enviada. La oficina va a revisar tus cambios de servicios.',

    /* --- recurrentes / historial / galeria --- */
    'Fixed weekly jobs assigned to you — these don\'t have a due date, they repeat every week.': 'Trabajos fijos semanales asignados a ti; no tienen fecha límite, se repiten cada semana.',
    'Fixed weekly jobs in your department — these don\'t have a due date, they repeat every week.': 'Trabajos fijos semanales de tu departamento; no tienen fecha límite, se repiten cada semana.',
    'No recurring jobs coming up in the next 3 days.': 'No hay trabajos recurrentes en los próximos 3 días.',
    'No recurring jobs in your department right now.': 'Ahorita no hay trabajos recurrentes en tu departamento.',
    'Orders you\'ve already worked on, with their full status history.': 'Órdenes en las que ya trabajaste, con todo su historial.',
    'Orders your department has already worked on, with their full status history.': 'Órdenes en las que ya trabajó tu departamento, con todo su historial.',
    'No completed or cancelled orders yet.': 'Todavía no hay órdenes completadas o canceladas.',
    'Photos you\'ve taken, grouped by order.': 'Tus fotos, agrupadas por orden.',
    'Photos taken across your department, grouped by order.': 'Fotos de tu departamento, agrupadas por orden.',
    'No photos yet.': 'Todavía no hay fotos.',
    'Photos': 'Fotos',
    'Scheduled Services': 'Servicios programados',
    'Inspection · before': 'Inspección · antes',
    'Work · after': 'Trabajo · después',
    'Inspection photos · before': 'Fotos de inspección · antes'
  };

  /* Frases con numeros o nombres pegados. */
  var PATTERNS = [
    [/^In (\d+) days$/, 'En $1 días'],
    [/^(\d+) services?$/, function (m, n) { return n + (n === '1' ? ' servicio' : ' servicios'); }],
    [/^(\d+) photos?$/, function (m, n) { return n + (n === '1' ? ' foto' : ' fotos'); }],
    [/^Not scheduled yet · (\d+) services?$/, function (m, n) { return 'Sin programar · ' + n + (n === '1' ? ' servicio' : ' servicios'); }],
    [/^Service changes saved \((\d+) services\)\. They go to the office when you finish the inspection\.$/, 'Cambios de servicios guardados ($1 servicios). Se mandan a la oficina cuando termines la inspección.'],
    [/^Could not (send the inspection|send this update|send it|send the report|save that|mark this done|mark this service done|mark this order Completed): (.*)$/, function (m, what, err) {
      var map = { 'send the inspection': 'enviar la inspección', 'send this update': 'enviar este cambio', 'send it': 'enviarlo', 'send the report': 'enviar el reporte',
        'save that': 'guardar', 'mark this done': 'marcar como terminado', 'mark this service done': 'marcar el servicio como terminado', 'mark this order Completed': 'marcar la orden como completada' };
      return 'No se pudo ' + (map[what] || what) + ': ' + err;
    }],
    [/^Could not open this file: (.*)$/, 'No se pudo abrir el archivo: $1'],
    [/^Created ([^·]+)$/, 'Creada $1'],
    [/^Unit ([^·]+)$/, 'Unidad $1'],
    [/^Building ([^·]+)$/, 'Edificio $1'],
    [/^Bldg ([^·]+)$/, 'Edif. $1'],
    [/^(\d+)\s*bd\s*\/\s*(\d+(?:\.\d)?)\s*ba$/, '$1 rec / $2 baño'],
    [/^Hi, (.+)$/, 'Hola, $1'],
    [/^Inspection ([^·]+)$/, 'Inspección $1'],
    [/^(.+) — Qty: (.+)$/, function (m, a, b) { return t(a) + ' — Cant.: ' + b; }],
    [/^(.+) — Level (\d)(.*)$/, function (m, a, n, rest) { return t(a) + ' — Nivel ' + n + t(rest); }],
    [/^(.+) \(Level (\d)\)$/, function (m, a, n) { return t(a) + ' (Nivel ' + n + ')'; }],
    [/^(.+) × (\d+)$/, function (m, a, n) { return t(a) + ' × ' + n; }],
    [/^Qty: (.+)$/, 'Cant.: $1'],
    [/^Level (\d)$/, 'Nivel $1']
  ];

  /* Dias de la semana ("Mon, Wed, Fri") de los recurrentes. */
  var DAYS = { Mon: 'Lun', Tue: 'Mar', Wed: 'Mié', Thu: 'Jue', Fri: 'Vie', Sat: 'Sáb', Sun: 'Dom',
    Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo' };
  var DAYS_RE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(\s*,\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*$/;

  /* Diccionario que llega del servidor (servicios, categorias, areas). */
  var TERMS_KEY = 'gs_tech_terms';
  var DYN = {};
  try { DYN = (JSON.parse(localStorage.getItem(TERMS_KEY) || 'null') || {}).terms || {}; } catch (e) { DYN = {}; }

  function lang() {
    try { return localStorage.getItem(KEY) === 'es' ? 'es' : 'en'; } catch (e) { return 'en'; }
  }

  function t(s) {
    if (lang() !== 'es' || s == null) return s;
    var str = String(s);
    var lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];
    var core = str.trim();
    if (!core) return s;
    if (Object.prototype.hasOwnProperty.call(ES, core)) return lead + ES[core] + trail;
    if (Object.prototype.hasOwnProperty.call(DYN, core)) return lead + DYN[core] + trail;
    /* Viñeta o emoji al principio ("• Hallway Vacuum"): se traduce lo demas. */
    var pre = core.match(/^([•·✓✔→\-–—]\s+|(?:\p{Extended_Pictographic}\uFE0F?\s*)+)(.+)$/u);
    if (pre) { var rest = t(pre[2]); if (rest !== pre[2]) return lead + pre[1] + rest + trail; }
    if (DAYS_RE.test(core)) return lead + core.replace(/[A-Za-z]+/g, function (d) { return DAYS[d] || d; }) + trail;
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i][0].test(core)) return lead + core.replace(PATTERNS[i][0], PATTERNS[i][1]) + trail;
    }
    /* Lineas armadas con " · " (direccion · edificio · unidad · fecha):
       se traduce cada pedazo por su cuenta. */
    if (core.indexOf(' · ') !== -1) {
      var parts = core.split(' · '), changed = false;
      parts = parts.map(function (x) { var y = t(x); if (y !== x) changed = true; return y; });
      if (changed) return lead + parts.join(' · ') + trail;
    }
    return s;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, CODE: 1 };
  function translateTree(root) {
    if (lang() !== 'es' || !root) return;
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1 || (root.hasAttribute && root.hasAttribute('data-no-i18n'))) return;
    translateAttrs(root);
    if (SKIP[root.tagName]) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (n.hasAttribute('data-no-i18n')) return NodeFilter.FILTER_REJECT;
          translateAttrs(n);
          return SKIP[n.tagName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) translateText(node);
  }
  /* Se guarda el ingles de cada texto: cuando llega el diccionario del
     servidor se vuelve a traducir desde el original, no desde lo que
     ya quedo a medias ("Drywall Patch — Cant.: 2"). */
  function translateText(node) {
    var cur = node.nodeValue;
    var src = (node.__gsOut !== undefined && cur === node.__gsOut) ? node.__gsEn : cur;
    var next = t(src);
    if (next !== cur) { node.__gsEn = src; node.__gsOut = next; node.nodeValue = next; }
  }
  function translateAttrs(el) {
    ['placeholder', 'title', 'aria-label'].forEach(function (a) {
      if (el.hasAttribute && el.hasAttribute(a)) {
        var v = el.getAttribute(a), nv = t(v);
        if (nv !== v) el.setAttribute(a, nv);
      }
    });
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) {
      var bv = t(el.value); if (bv !== el.value) el.value = bv;
    }
  }

  /* Pide el diccionario al servidor (solo en ESP y con sesion). Lo del
     telefono se usa luego luego; se refresca cada 30 min. */
  function loadTerms() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(TERMS_KEY) || 'null'); } catch (e) {}
    if (cached && cached.at && Date.now() - cached.at < 30 * 60 * 1000 && !cached.missing) return;
    var hasSession = false;
    try { hasSession = !!sessionStorage.getItem('gs_tech'); } catch (e) {}
    if (!hasSession || !window.fetch) return;
    fetch('/api/get-es-terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.terms) return;
        DYN = d.terms;
        try { localStorage.setItem(TERMS_KEY, JSON.stringify({ at: Date.now(), terms: DYN, missing: d.missing || 0 })); } catch (e) {}
        translateTree(document.body);
      })
      .catch(function () {});
  }

  /* Fechas: las pantallas piden 'en-US'; en ESP se cambia a 'es-MX'. */
  ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'].forEach(function (fn) {
    var orig = Date.prototype[fn];
    Date.prototype[fn] = function (loc, opts) {
      if (lang() === 'es' && (!loc || loc === 'en-US' || loc === 'en')) loc = 'es-MX';
      return orig.call(this, loc, opts);
    };
  });

  function start() {
    if (lang() !== 'es') return;
    document.documentElement.lang = 'es';
    loadTerms();
    translateTree(document.body);
    if (document.title) document.title = t(document.title);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'characterData') translateTree(m.target);
        else if (m.type === 'attributes') translateAttrs(m.target);
        else m.addedNodes.forEach(translateTree);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  }

  /* alert/confirm/prompt tambien en espanol */
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = window[fn];
    if (!orig) return;
    window[fn] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = t(msg);
      return orig.apply(window, args);
    };
  });

  /* Selector ENG | ESP. mountToggle(el): lo pone al final de el. */
  function mountToggle(el, before) {
    if (!el || el.querySelector('.gs-lang')) return;
    var cur = lang();
    var wrap = document.createElement('span');
    wrap.className = 'gs-lang';
    wrap.setAttribute('data-no-i18n', '');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Language');
    wrap.innerHTML = '<button type="button" data-l="en"' + (cur === 'en' ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>ENG</button>' +
      '<button type="button" data-l="es"' + (cur === 'es' ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>ESP</button>';
    wrap.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-l]');
      if (!b || b.getAttribute('data-l') === lang()) return;
      setLang(b.getAttribute('data-l'), true);
    });
    if (before && before.parentNode === el) el.insertBefore(wrap, before); else el.appendChild(wrap);
    if (!document.getElementById('gs-lang-style')) {
      var st = document.createElement('style');
      st.id = 'gs-lang-style';
      st.textContent = '.gs-lang{display:inline-flex;gap:2px;margin:0 8px;padding:2px;border:1px solid rgba(140,111,42,.45);border-radius:99px;vertical-align:middle}' +
        '.gs-lang button{all:unset;cursor:pointer;font:600 11px/1 Inter,sans-serif;letter-spacing:.06em;padding:5px 9px;border-radius:99px;color:inherit;opacity:.7}' +
        '.gs-lang button.on{background:#C9A84C;color:#fff;opacity:1}' +
        '.gs-lang button:focus-visible{outline:2px solid #C9A84C;outline-offset:1px}';
      document.head.appendChild(st);
    }
  }

  /* save=true: tambien lo guarda en Techs.Language (si hay sesion). */
  function setLang(l, save) {
    l = l === 'es' ? 'es' : 'en';
    try { localStorage.setItem(KEY, l); } catch (e) {}
    try {
      var s = JSON.parse(sessionStorage.getItem('gs_tech') || 'null');
      if (s) { s.language = l; sessionStorage.setItem('gs_tech', JSON.stringify(s)); }
    } catch (e) {}
    var done = function () { location.reload(); };
    if (save && window.fetch) {
      fetch('/api/save-tech-language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: l }) })
        .then(done, done);
    } else done();
  }

  /* El idioma guardado en la cuenta (login) gana sobre el del telefono. */
  function adoptFromSession(tech) {
    var l = tech && (tech.language === 'es' || tech.language === 'en') ? tech.language : null;
    if (!l) return false;
    if (l === lang()) return false;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    return true;
  }

  window.GSI18n = { t: t, lang: lang, setLang: setLang, mountToggle: mountToggle, translateTree: translateTree, adoptFromSession: adoptFromSession, ES: ES, terms: function () { return DYN; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
