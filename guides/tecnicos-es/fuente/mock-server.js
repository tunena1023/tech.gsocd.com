/* Servidor de prueba: sirve el portal Tech REAL (archivos del repo tal cual)
   y contesta /api/* con datos de ejemplo. Solo para sacar capturas de la guia. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..'); // raiz del repo tech.gsocd.com
const HERE = __dirname;
const PORT = 8787;
const FAIL_UPLOADS = { on: false };

const T = (d, h, m = 0) => new Date(Date.UTC(2026, 8, d, h + 5, m)).toISOString(); // hora de Iowa (CDT = UTC-5)
const EMP = 'Carlos Ramírez', SUP = 'Laura Méndez';

const res = (cat, name, sku, extra = {}) => Object.assign({ Category: cat, ServiceName: name, SubOption: sku, Division: 'Renovations', Level: '', Quantity: '' }, extra);

function employeeOrders() {
  return [
    { id: '1', createdDateTime: T(22, 9, 14), OrderID: 'GS-10482', ClientID: 'C-118', BusinessName: 'Maple Ridge Apartments', Division: 'Renovations', Status: 'Active', Supervisor: SUP,
      Address: '1450 Maple Ridge Dr', BuildingNumber: '3', UnitNumber: '214', Bedrooms: '2', Bathrooms: '1',
      EntryDate: T(22, 8), DueDate: T(29, 17), ServiceWindow: 'Sep 26 · 8:00 AM – 12:00 PM', DispatchDate: T(26, 8),
      Services: [res('Residential', 'Paint walls', 'REN-PAINT', { Level: 'Level 2' }), res('Residential', 'Replace carpet', 'REN-CARPET', { Quantity: '2' }), res('Residential', 'Deep clean kitchen', 'REN-KCLEAN')],
      PackageSnapshots: {} },
    { id: '2', createdDateTime: T(23, 14, 2), OrderID: 'GS-10477', ClientID: 'C-121', BusinessName: 'Oakview Townhomes', Division: 'Renovations', Status: 'Active', Supervisor: SUP,
      Address: '88 Oakview Ct', UnitNumber: '12', Bedrooms: '3', Bathrooms: '2', UnitOccupied: true, NeedsOfficeAccess: true, OfficeNeedNotes: 'Pick up the keys at the leasing office before 9 AM.',
      EntryDate: T(23, 8), DueDate: T(30, 17), ServiceWindow: 'Sep 27 · 9:00 AM – 1:00 PM', DispatchDate: T(27, 9),
      Services: [res('Residential', 'Turn package', 'PKG-TURN'), res('Residential', 'Replace blinds', 'REN-BLINDS', { Quantity: '4' })],
      PackageSnapshots: { 'PKG-TURN': [{ sku: 'REN-PATCH', serviceName: 'Patch drywall', level: 'Level 2' }, { sku: 'REN-PAINT', serviceName: 'Paint walls', level: 'Level 1' }, { sku: 'REN-KCLEAN', serviceName: 'Deep clean kitchen' }, { sku: 'REN-BCLEAN', serviceName: 'Deep clean bathroom' }] } },
    { id: '3', createdDateTime: T(21, 10, 30), OrderID: 'GS-10490', ClientID: 'C-130', BusinessName: 'Riverside Lofts', Division: 'Renovations', Status: 'Active', Supervisor: SUP,
      Address: '301 River St', UnitNumber: '5B', Bedrooms: '1', Bathrooms: '1', AssignByService: true,
      EntryDate: T(21, 8), DueDate: T(30, 17), ServiceWindow: '', DispatchDate: T(24, 8),
      Services: [res('Residential', 'Patch drywall', 'REN-PATCH', { Level: 'Level 1' }), res('Residential', 'Paint walls', 'REN-PAINT', { Level: 'Level 2' }), res('Residential', 'Replace light fixture', 'REN-LIGHT', { Quantity: '3' }), res('Residential', 'Clean carpets', 'REN-CCLEAN')],
      MyServiceAssignments: [
        { Category: 'Residential', ServiceName: 'Patch drywall', AssignedTo: EMP, ScheduledDate: T(24, 8), WorkStatus: 'Completed' },
        { Category: 'Residential', ServiceName: 'Paint walls', AssignedTo: EMP, ScheduledDate: T(25, 8), WorkStatus: 'Pending Review' },
        { Category: 'Residential', ServiceName: 'Replace light fixture', AssignedTo: EMP, ScheduledDate: T(26, 13), WorkStatus: 'Scheduled' }
      ], PackageSnapshots: {} },
    { id: '4', createdDateTime: T(25, 18, 0), OrderID: 'GS-10495', ClientID: 'C-140', BusinessName: 'Hillcrest Medical Plaza', Division: 'Janitorial', Status: 'Active', Supervisor: SUP,
      Address: '2200 Hillcrest Ave', AssignByService: true, RecurringServiceID: 'RS-22',
      EntryDate: T(26, 18), DueDate: T(26, 23), ServiceWindow: 'Sep 26 · 6:00 PM – 10:00 PM', DispatchDate: T(26, 18),
      Services: [
        { Category: 'Floor 1 / Lobby', ServiceName: 'Vacuum carpets', SubOption: 'JAN-VAC', Division: 'Janitorial', Level: 'Level 2' },
        { Category: 'Floor 1 / Lobby', ServiceName: 'Mop hard floors', SubOption: 'JAN-MOP', Division: 'Janitorial', Level: 'Level 1' },
        { Category: 'Floor 1 / Restrooms', ServiceName: 'Clean restrooms', SubOption: 'JAN-REST', Division: 'Janitorial', Level: 'Level 2' },
        { Category: 'Floor 1 / Restrooms', ServiceName: 'Restock supplies', SubOption: 'JAN-STOCK', Division: 'Janitorial' },
        { Category: 'Floor 2 / Offices', ServiceName: 'Empty trash', SubOption: 'JAN-TRASH', Division: 'Janitorial' },
        { Category: 'Floor 2 / Offices', ServiceName: 'Dust surfaces', SubOption: 'JAN-DUST', Division: 'Janitorial', Level: 'Level 1' }
      ],
      MyServiceAssignments: [
        { Category: 'Floor 1 / Lobby', ServiceName: 'Vacuum carpets', AssignedTo: EMP, ScheduledDate: T(26, 18), WorkStatus: 'Pending Review' },
        { Category: 'Floor 1 / Lobby', ServiceName: 'Mop hard floors', AssignedTo: EMP, ScheduledDate: T(26, 18), WorkStatus: 'Pending Review' },
        { Category: 'Floor 1 / Restrooms', ServiceName: 'Clean restrooms', AssignedTo: EMP, ScheduledDate: T(26, 18), WorkStatus: 'Scheduled' },
        { Category: 'Floor 1 / Restrooms', ServiceName: 'Restock supplies', AssignedTo: EMP, ScheduledDate: T(26, 18), WorkStatus: 'Scheduled' },
        { Category: 'Floor 2 / Offices', ServiceName: 'Empty trash', AssignedTo: EMP, ScheduledDate: T(26, 18), WorkStatus: 'Scheduled' },
        { Category: 'Floor 2 / Offices', ServiceName: 'Dust surfaces', AssignedTo: EMP, ScheduledDate: T(26, 18), WorkStatus: 'Scheduled' }
      ], PackageSnapshots: {} },
    { id: '5', createdDateTime: T(20, 11, 45), OrderID: 'GS-10470', ClientID: 'C-150', BusinessName: 'Cedar Point Duplexes', Division: 'Renovations', Status: 'Active', Supervisor: SUP,
      Address: '17 Cedar Point Rd', UnitNumber: 'A', Bedrooms: '2', Bathrooms: '1', TechMarkedComplete: true,
      EntryDate: T(20, 8), DueDate: T(26, 17), ServiceWindow: 'Sep 25 · 8:00 AM – 4:00 PM', DispatchDate: T(25, 8),
      Services: [res('Residential', 'Replace carpet', 'REN-CARPET', { Quantity: '1' }), res('Residential', 'Paint walls', 'REN-PAINT', { Level: 'Level 1' })], PackageSnapshots: {} }
  ];
}

function supervisorOrders() {
  const e = employeeOrders();
  const riverside = Object.assign({}, e[2], {
    MyServiceAssignments: [
      { Category: 'Residential', ServiceName: 'Patch drywall', AssignedTo: EMP, ScheduledDate: T(24, 8), WorkStatus: 'Completed' },
      { Category: 'Residential', ServiceName: 'Paint walls', AssignedTo: EMP, ScheduledDate: T(24, 8), WorkStatus: 'Pending Review' },
      { Category: 'Residential', ServiceName: 'Replace light fixture', AssignedTo: 'Miguel Ortiz', ScheduledDate: T(27, 13), WorkStatus: 'Scheduled' }
    ] });
  return [
    { id: '9', createdDateTime: T(25, 16, 20), OrderID: 'GS-10501', ClientID: 'C-160', BusinessName: 'Pine Valley Apartments', Division: 'Renovations', Status: 'Inspection', Supervisor: SUP,
      Address: '640 Pine Valley Blvd', BuildingNumber: '2', UnitNumber: '108', Bedrooms: '2', Bathrooms: '2',
      InspectionDate: T(26, 9), InspectionWindow: '9:00 AM – 10:00 AM', DueDate: T(3 + 30, 17),
      Services: [res('Residential', 'Replace carpet', 'REN-CARPET', { Quantity: '3' }), res('Residential', 'Paint walls', 'REN-PAINT', { Level: 'Level 2' }), res('Residential', 'Replace blinds', 'REN-BLINDS', { Quantity: '5' })], PackageSnapshots: {} },
    e[0], riverside,
    { id: '10', createdDateTime: T(24, 8, 5), OrderID: 'GS-10486', ClientID: 'C-170', BusinessName: 'Summit Bank – Downtown', Division: 'Janitorial', Status: 'Active', Supervisor: 'Jorge Salinas',
      Address: '500 Walnut St', EntryDate: T(27, 19), DueDate: T(27, 23), ServiceWindow: 'Sep 27 · 7:00 PM – 11:00 PM', DispatchDate: T(27, 19),
      Services: [{ Category: 'Commercial', ServiceName: 'Strip and wax floors', SubOption: 'JAN-WAX', Division: 'Janitorial', Level: 'Level 3' }, { Category: 'Commercial', ServiceName: 'Clean windows (interior)', SubOption: 'JAN-WIN', Division: 'Janitorial' }], PackageSnapshots: {} },
    { id: '11', createdDateTime: T(23, 13, 0), OrderID: 'GS-10480', ClientID: 'C-180', BusinessName: 'Westgate Retail Center', Division: 'Exteriors', Status: 'Active', Supervisor: 'Jorge Salinas',
      Address: '9100 Westgate Pkwy', EntryDate: T(28, 8), DueDate: T(30, 17), ServiceWindow: 'Sep 28 · 8:00 AM – 12:00 PM', DispatchDate: T(28, 8),
      Services: [{ Category: 'Commercial', ServiceName: 'Pressure wash sidewalks', SubOption: 'EXT-PW', Division: 'Exteriors' }], PackageSnapshots: {} }
  ];
}

const svcJ = (n, l, q) => Object.assign({ ServiceName: n }, l ? { Level: l } : {}, q ? { Quantity: q } : {});
function recurring(role) {
  const base = [
    { id: 'RS-31', clientId: 'C-140', businessName: 'Hillcrest Medical Plaza', address: '2200 Hillcrest Ave', buildingNumber: 'A', division: 'Janitorial', daysOfWeek: 'Mon, Wed, Sat', time: '6:00 PM', daysUntil: 0,
      Services: [svcJ('Vacuum carpets', 'Level 2'), svcJ('Empty trash'), svcJ('Clean restrooms', 'Level 1'), svcJ('Restock supplies')] },
    { id: 'RS-40', clientId: 'C-170', businessName: 'Summit Bank – Downtown', address: '500 Walnut St', buildingNumber: '', division: 'Janitorial', daysOfWeek: 'Sun', time: '7:00 AM', daysUntil: 1,
      Services: [svcJ('Mop hard floors', 'Level 1'), svcJ('Dust surfaces')] },
    { id: 'RS-35', clientId: 'C-190', businessName: 'Oakview Office Park', address: '75 Oakview Pkwy', buildingNumber: '2', division: 'Janitorial', daysOfWeek: 'Tue, Thu', time: '5:30 PM', daysUntil: 3,
      Services: [svcJ('Vacuum carpets', 'Level 1'), svcJ('Clean kitchenette'), svcJ('Empty trash')] }
  ];
  return base.map(r => Object.assign({}, r, role === 'Employee' ? { hoursAllocated: r.id === 'RS-31' ? 3 : 2 } : { totalHours: r.id === 'RS-31' ? 6 : 4 }));
}

const created = (svcs, entry, due, win) => 'SERVICES:' + JSON.stringify({ services: svcs, entryDate: entry, dueDate: due, serviceWindow: win });
function historyOrders() {
  return [
    { createdDateTime: T(15, 9), OrderID: 'GS-10431', BusinessName: 'Maple Ridge Apartments', Division: 'Renovations', Status: 'Completed', EntryDate: T(15, 8), DueDate: T(19, 17),
      Address: '1450 Maple Ridge Dr', City: 'Des Moines', Zip: '50310', Contact: 'Front office · (515) 555-0142', Supervisor: SUP, CompletedDate: T(18, 15), BuildingNumber: '1', UnitNumber: '102', Bedrooms: '1', Bathrooms: '1', ServiceWindow: 'Sep 17 · 8:00 AM – 4:00 PM', Notes: 'Tenant moving in Sep 20.',
      Services: [{ ServiceName: 'Paint walls' }, { ServiceName: 'Replace blinds' }, { ServiceName: 'Clean carpets', NotCompleted: true, NotCompletedReason: 'Carpet will be replaced instead' }],
      History: [
        { ChangeType: 'Created', ChangedBy: 'Maple Ridge Apartments', ChangeDate: T(15, 9), FieldChanged: 'Status', NewValue: created([{ Category: 'Residential', ServiceName: 'Paint walls' }, { Category: 'Residential', ServiceName: 'Replace blinds' }, { Category: 'Residential', ServiceName: 'Clean carpets' }], '2026-09-15', '2026-09-19', 'Sep 17 · 8:00 AM – 4:00 PM') },
        { ChangeType: 'Order Assigned', ChangedBy: 'Office', ChangeDate: T(15, 11), FieldChanged: 'Status', NewValue: JSON.stringify({ supervisor: SUP, dispatchDate: '2026-09-17', serviceWindow: '8:00 AM – 4:00 PM' }) },
        { ChangeType: 'Tech Marked Complete', ChangedBy: EMP, ChangeDate: T(18, 14, 40), FieldChanged: 'Status' },
        { ChangeType: 'Completed', ChangedBy: 'Office', ChangeDate: T(18, 15), FieldChanged: 'Status' }
      ] },
    { createdDateTime: T(10, 10), OrderID: 'GS-10402', BusinessName: 'Riverside Lofts', Division: 'Renovations', Status: 'Completed', EntryDate: T(10, 8), DueDate: T(14, 17),
      Address: '301 River St', City: 'Des Moines', Zip: '50309', Supervisor: SUP, CompletedDate: T(13, 16), UnitNumber: '3A', Bedrooms: '2', Bathrooms: '1',
      Services: [{ ServiceName: 'Deep clean kitchen' }, { ServiceName: 'Deep clean bathroom' }],
      History: [
        { ChangeType: 'Created', ChangedBy: 'Riverside Lofts', ChangeDate: T(10, 10), FieldChanged: 'Status', NewValue: created([{ Category: 'Residential', ServiceName: 'Deep clean kitchen' }, { Category: 'Residential', ServiceName: 'Deep clean bathroom' }], '2026-09-10', '2026-09-14', '') },
        { ChangeType: 'Order Assigned', ChangedBy: 'Office', ChangeDate: T(10, 13), FieldChanged: 'Status', NewValue: JSON.stringify({ supervisor: SUP, dispatchDate: '2026-09-13' }) },
        { ChangeType: 'Completed', ChangedBy: 'Office', ChangeDate: T(13, 16), FieldChanged: 'Status' }
      ] },
    { createdDateTime: T(8, 15), OrderID: 'GS-10388', BusinessName: 'Oakview Townhomes', Division: 'Renovations', Status: 'Cancelled', EntryDate: T(8, 8), DueDate: T(12, 17),
      Address: '88 Oakview Ct', City: 'West Des Moines', Zip: '50265', Supervisor: SUP, UnitNumber: '7', Bedrooms: '2', Bathrooms: '2',
      Services: [{ ServiceName: 'Replace carpet' }],
      History: [
        { ChangeType: 'Created', ChangedBy: 'Oakview Townhomes', ChangeDate: T(8, 15), FieldChanged: 'Status', NewValue: created([{ Category: 'Residential', ServiceName: 'Replace carpet' }], '2026-09-08', '2026-09-12', '') },
        { ChangeType: 'Cancellation Requested', ChangedBy: 'Oakview Townhomes', ChangeDate: T(9, 10), FieldChanged: 'Status', Notes: 'The tenant renewed the lease.' },
        { ChangeType: 'Cancellation Approved', ChangedBy: 'Office', ChangeDate: T(9, 12), FieldChanged: 'Status' }
      ] }
  ];
}

const ph = (f, extra = {}) => Object.assign({ name: f + '.jpg', downloadUrl: '/mock-photos/' + f + '.jpg', stage: 'work' }, extra);
function gallery() {
  return {
    groups: [
      { orderId: 'GS-10482', clientLabel: 'Maple Ridge Apartments', division: 'Renovations', date: T(22, 8), bedrooms: '2', bathrooms: '1', supervisor: SUP, unitNumber: '214',
        services: [{ name: 'Paint walls', level: 'Level 2' }, { name: 'Replace carpet', level: '' }, { name: 'Deep clean kitchen', level: '' }],
        photos: [ph('living', { serviceName: 'Paint walls', level: 'Level 2', caption: 'Sep 26, 11:40 AM', sortKey: '2026-09-26T16:40:00Z' }), ph('carpet', { serviceName: 'Replace carpet', caption: 'Sep 26, 10:20 AM', sortKey: '2026-09-26T15:20:00Z' }), ph('kitchen', { serviceName: 'Deep clean kitchen', caption: 'Sep 26, 11:05 AM', sortKey: '2026-09-26T16:05:00Z' }), ph('hallway', { caption: 'Sep 26, 9:50 AM', sortKey: '2026-09-26T14:50:00Z' })] },
      { orderId: 'GS-10490', clientLabel: 'Riverside Lofts', division: 'Renovations', date: T(21, 8), bedrooms: '1', bathrooms: '1', supervisor: SUP, unitNumber: '5B',
        services: [{ name: 'Patch drywall', level: 'Level 1' }, { name: 'Paint walls', level: 'Level 2' }],
        photos: [ph('drywall', { serviceName: 'Patch drywall', caption: 'Sep 24, 9:40 AM' }), ph('bathroom', { caption: 'Sep 24' })] },
      { orderId: 'GS-10501', clientLabel: 'Pine Valley Apartments', division: 'Renovations', date: T(25, 8), unitNumber: '108', services: [],
        photos: [ph('carpet', { name: 'insp-1.jpg', stage: 'inspection', caption: 'Inspection · Sep 26' }), ph('living', { name: 'insp-2.jpg', stage: 'inspection', caption: 'Inspection · Sep 26' })] }
    ],
    docGroups: [
      { orderId: 'GS-10482', clientLabel: 'Maple Ridge Apartments · Unit 214', date: T(22, 10), docs: [
        { id: 'd1', orderId: 'GS-10482', clientId: 'C-118', name: 'Scope of work.pdf', size: 184320, by: 'Office', uploaderName: 'Office', uploadedAt: T(22, 10) },
        { id: 'd2', orderId: 'GS-10482', clientId: 'C-118', name: 'Paint colors.docx', size: 40960, by: 'Client', uploaderName: 'Maple Ridge Apartments', uploadedAt: T(23, 9) }] },
      { orderId: 'GS-10477', clientLabel: 'Oakview Townhomes · Unit 12', date: T(23, 15), docs: [
        { id: 'd3', orderId: 'GS-10477', clientId: 'C-121', name: 'Access instructions.txt', size: 2048, by: 'Office', uploaderName: 'Office', uploadedAt: T(23, 15) }] }
    ]
  };
}

const AREAS = { 'JAN-VAC': ['Hallways & Floors', 'Offices & Meeting Rooms'], 'JAN-MOP': ['Hallways & Floors', 'Lobby & Entry'], 'JAN-WAX': ['Hallways & Floors'], 'JAN-REST': ['Restrooms & Locker Rooms'], 'JAN-STOCK': ['Restrooms & Locker Rooms'], 'JAN-TRASH': ['Trash', 'Offices & Meeting Rooms'], 'JAN-DUST': ['Offices & Meeting Rooms', 'Lobby & Entry'], 'JAN-KIT': ['Kitchen & Breakroom'], 'JAN-WIN': ['Lobby & Entry'], 'JAN-GLASS': ['Lobby & Entry'] };
const cat = (sku, serviceName, division, propertyType, category, description, requiresQuantity) => ({ sku, serviceName, division, propertyType, category: division === 'Janitorial' ? 'Common Areas' : category, description: description || '', areas: AREAS[sku] || [], packageItems: [], active: true, requiresQuantity: !!requiresQuantity });
const CATALOG = [
  cat('REN-PAINT', 'Paint walls', 'Renovations', 'Residential', 'Paint', 'Two coats of interior paint on walls, standard colors.'),
  cat('REN-CARPET', 'Replace carpet', 'Renovations', 'Residential', 'Flooring', 'Remove old carpet and pad, install new carpet per room.', true),
  cat('REN-KCLEAN', 'Deep clean kitchen', 'Renovations', 'Residential', 'Cleaning', 'Appliances inside and out, cabinets, counters, sink and floor.'),
  cat('REN-BCLEAN', 'Deep clean bathroom', 'Renovations', 'Residential', 'Cleaning'),
  cat('REN-PATCH', 'Patch drywall', 'Renovations', 'Residential', 'Walls'),
  cat('REN-BLINDS', 'Replace blinds', 'Renovations', 'Residential', 'Windows', '', true),
  cat('REN-LIGHT', 'Replace light fixture', 'Renovations', 'Residential', 'Electrical', '', true),
  cat('REN-CCLEAN', 'Clean carpets', 'Renovations', 'Residential', 'Cleaning'),
  cat('REN-CAULK', 'Re-caulk tub and sink', 'Renovations', 'Residential', 'Bathroom'),
  cat('REN-OUTLET', 'Replace outlet covers', 'Renovations', 'Residential', 'Electrical', '', true),
  cat('REN-DOOR', 'Replace door', 'Renovations', 'Residential', 'Doors', '', true),
  cat('REN-FILTER', 'Replace air filter', 'Renovations', 'Residential', 'HVAC'),
  cat('PKG-TURN', 'Turn package', 'Renovations', 'Residential', 'Packages', 'Everything a unit needs between tenants.'),
  cat('JAN-VAC', 'Vacuum carpets', 'Janitorial', 'Commercial', 'Floors'),
  cat('JAN-MOP', 'Mop hard floors', 'Janitorial', 'Commercial', 'Floors'),
  cat('JAN-WAX', 'Strip and wax floors', 'Janitorial', 'Commercial', 'Floors'),
  cat('JAN-REST', 'Clean restrooms', 'Janitorial', 'Commercial', 'Restrooms', 'Toilets, sinks, mirrors, partitions and floor.'),
  cat('JAN-STOCK', 'Restock supplies', 'Janitorial', 'Commercial', 'Restrooms'),
  cat('JAN-TRASH', 'Empty trash', 'Janitorial', 'Commercial', 'General'),
  cat('JAN-DUST', 'Dust surfaces', 'Janitorial', 'Commercial', 'General'),
  cat('JAN-KIT', 'Clean kitchenette', 'Janitorial', 'Commercial', 'General'),
  cat('JAN-WIN', 'Clean windows (interior)', 'Janitorial', 'Commercial', 'Windows'),
  cat('JAN-GLASS', 'Clean entrance glass', 'Janitorial', 'Commercial', 'Windows')
];

const rcHistory = () => ({ history: [
  { ChangeType: 'Tech Marked Complete', ChangedBy: EMP, ChangeDate: T(21, 21, 50), FieldChanged: 'Status', Notes: 'Visit Sep 21' },
  { ChangeType: 'Completed', ChangedBy: 'Office', ChangeDate: T(22, 8, 45), FieldChanged: 'Status', Notes: 'Visit Sep 21' },
  { ChangeType: 'Tech Marked Complete', ChangedBy: EMP, ChangeDate: T(24, 21, 35), FieldChanged: 'Status', Notes: 'Visit Sep 24' },
  { ChangeType: 'Completed', ChangedBy: 'Office', ChangeDate: T(25, 9, 10), FieldChanged: 'Status', Notes: 'Visit Sep 24' }
] });

const TECHS = {
  Employee: { id: 'T-1042', firstName: 'Carlos', lastName: 'Ramírez', role: 'Employee', division: 'Renovations', language: 'en' },
  Supervisor: { id: 'T-2001', firstName: 'Laura', lastName: 'Méndez', role: 'Supervisor', division: 'Mixed', language: 'en' }
};

function api(route, body) {
  switch (route) {
    case 'get-my-orders': {
      const sup = body.role !== 'Employee';
      return { orders: sup ? supervisorOrders() : employeeOrders(), recurring: recurring(body.role), crewOptions: sup ? ['Carlos Ramírez', 'Miguel Ortiz', 'Ana López', 'José Hernández'] : [] };
    }
    case 'get-catalog': {
      const d = String(body.division || '').toLowerCase(), p = String(body.propertyType || '').toLowerCase();
      return { catalog: CATALOG.filter(c => (!d || c.division.toLowerCase() === d) && (!p || c.propertyType.toLowerCase() === p)) };
    }
    case 'get-my-history': return { orders: historyOrders() };
    case 'get-my-gallery': return gallery();
    case 'get-recurring-history': return rcHistory();
    case 'get-es-terms': return { terms: {}, missing: [] };
    case 'order-docs': return { viewUrl: '/mock-photos/scope.html', downloadUrl: '/mock-photos/scope.pdf' };
    case 'device-auth':
      if (body.action === 'verify-setup') return { firstName: 'Carlos' };
      if (body.action === 'activate-device') return { deviceToken: 'demo-token', tech: TECHS.Employee };
      return { __status: 404, error: 'Not found' };
    case 'tech-session': return { __status: 401, error: 'No session' };
    case 'login-tech': return { __status: 404, error: 'We could not find an account with that name and phone digits.' };
    case 'register-tech': return { pending: true };
    case 'save-push-subscription': case 'save-tech-language': return { ok: true };
    case 'upload-photo': case 'upload-service-photo': case 'upload-recurring-photo':
      if (FAIL_UPLOADS.on) return { __status: 503, error: 'No signal' };
      return { ok: true };
    case 'submit-employee-complete': case 'submit-service-complete': case 'submit-recurring-complete':
    case 'submit-extra-request': case 'submit-supervisor-update': case 'submit-recurring-update':
    case 'report-unit-not-ready': case 'submit-inspection-done':
      return { ok: true };
    default: return { __status: 404, error: 'unknown ' + route };
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.svg': 'image/svg+xml' };
http.createServer((req, resp) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__fail-uploads') { FAIL_UPLOADS.on = u.searchParams.get('on') === '1'; resp.end('ok'); return; }
  if (u.pathname.startsWith('/api/')) {
    const route = u.pathname.slice(5);
    if (route === 'site-image') {
      const f = path.join(HERE, 'assets', path.basename(u.searchParams.get('name') || ''));
      if (fs.existsSync(f)) { resp.writeHead(200, { 'Content-Type': 'image/jpeg' }); fs.createReadStream(f).pipe(resp); }
      else { resp.writeHead(404); resp.end(); }
      return;
    }
    let data = ''; req.on('data', c => data += c); req.on('end', () => {
      let body = {}; try { body = JSON.parse(data || '{}'); } catch (e) {}
      const out = api(route, body); const st = out.__status || 200; delete out.__status;
      resp.writeHead(st, { 'Content-Type': 'application/json' }); resp.end(JSON.stringify(out));
    });
    return;
  }
  let file = u.pathname.startsWith('/mock-photos/') ? path.join(HERE, 'photos', path.basename(u.pathname)) : path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { resp.writeHead(404); resp.end('404'); return; }
  resp.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(resp);
}).listen(PORT, () => console.log('mock on ' + PORT));
