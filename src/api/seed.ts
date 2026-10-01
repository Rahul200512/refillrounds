import type {
  AuditEntry,
  Delivery,
  DeliveryItem,
  Facility,
  FillType,
  Medication,
  Order,
  Resident,
} from '@/models';
import { DAY_MS, HOUR_MS, MINUTE_MS, toDateKey, toIso } from '@/domain/dates';

// All data here is fictional. Every timestamp is computed relative to `now`
// so the demo always looks current, whenever it is opened.

export interface DemoDatabase {
  /** Local calendar day the data was generated; stale data is regenerated. */
  seededOn: string;
  facility: Facility;
  residents: Resident[];
  medications: Medication[];
  orders: Order[];
  delivery: Delivery;
  audit: AuditEntry[];
}

const PRESCRIBERS = {
  hart: 'Dr. Amelia Hart, MD',
  reyes: 'Dr. Marcus Reyes, DO',
  nair: 'Dr. Priya Nair, MD',
};

const NIGHT_NURSE = 'Avery Brooks, RN';
const PHARMACIST = 'Pharmacy — D. Whitfield, PharmD';

const facility: Facility = {
  id: 'fac-1',
  name: 'Willow Creek Care Center',
  units: [
    { id: 'unit-magnolia', name: 'Magnolia Wing' },
    { id: 'unit-cedar', name: 'Cedar Wing' },
  ],
};

const residents: Resident[] = [
  { id: 'res-01', firstName: 'Eleanor', lastName: 'Whitcombe', room: 'M-101', unitId: 'unit-magnolia', allergies: ['Penicillin', 'Sulfa drugs'] },
  { id: 'res-02', firstName: 'Harold', lastName: 'Brennan', room: 'M-103', unitId: 'unit-magnolia', allergies: [] },
  { id: 'res-03', firstName: 'Dorothy', lastName: 'Kessler', room: 'M-105', unitId: 'unit-magnolia', allergies: ['Codeine'] },
  { id: 'res-04', firstName: 'Walter', lastName: 'Okafor', room: 'M-108', unitId: 'unit-magnolia', allergies: ['Aspirin'] },
  { id: 'res-05', firstName: 'Margaret', lastName: 'Lindqvist', room: 'M-110', unitId: 'unit-magnolia', allergies: [] },
  { id: 'res-06', firstName: 'Franklin', lastName: 'DeLuca', room: 'C-201', unitId: 'unit-cedar', allergies: ['Morphine'] },
  { id: 'res-07', firstName: 'Ruth', lastName: 'Abernathy', room: 'C-204', unitId: 'unit-cedar', allergies: ['Penicillin'] },
  { id: 'res-08', firstName: 'George', lastName: 'Tanaka', room: 'C-206', unitId: 'unit-cedar', allergies: [] },
  { id: 'res-09', firstName: 'Irene', lastName: 'Castellano', room: 'C-209', unitId: 'unit-cedar', allergies: ['Lisinopril (angioedema)'] },
  { id: 'res-10', firstName: 'Samuel', lastName: 'Whitaker', room: 'C-212', unitId: 'unit-cedar', allergies: ['Ciprofloxacin'] },
];

// [id, residentId, name, strength, form, directions, prescriber, fillType, daysSupply, daysRemaining, costPerFill]
type MedRow = [string, string, string, string, string, string, string, FillType, number, number, number];

const MED_ROWS: MedRow[] = [
  ['med-01a', 'res-01', 'Donepezil', '10 mg', 'Tablet', '1 tablet by mouth at bedtime', PRESCRIBERS.hart, 'cycle', 30, 1, 14],
  ['med-01b', 'res-01', 'Metoprolol tartrate', '25 mg', 'Tablet', '1 tablet by mouth twice daily. Hold if heart rate below 55.', PRESCRIBERS.hart, 'cycle', 30, 1, 9],
  ['med-01c', 'res-01', 'Acetaminophen', '500 mg', 'Tablet', '1–2 tablets by mouth every 6 hours as needed for pain. Max 3 g/day.', PRESCRIBERS.hart, 'prn', 30, 3, 6],
  ['med-01d', 'res-01', 'Senna', '8.6 mg', 'Tablet', '2 tablets by mouth at bedtime as needed for constipation', PRESCRIBERS.hart, 'prn', 30, 16, 5],

  ['med-02a', 'res-02', 'Atorvastatin', '40 mg', 'Tablet', '1 tablet by mouth at bedtime', PRESCRIBERS.reyes, 'cycle', 30, 1, 11],
  ['med-02b', 'res-02', 'Apixaban', '5 mg', 'Tablet', '1 tablet by mouth twice daily', PRESCRIBERS.reyes, 'cycle', 30, 14, 545],
  ['med-02c', 'res-02', 'Ondansetron ODT', '4 mg', 'Orally disintegrating tablet', 'Dissolve 1 tablet on tongue every 8 hours as needed for nausea', PRESCRIBERS.reyes, 'prn', 10, 0, 18],
  ['med-02d', 'res-02', 'Fidaxomicin', '200 mg', 'Tablet', '1 tablet by mouth twice daily for 10 days', PRESCRIBERS.reyes, 'course', 10, 0, 4200],

  ['med-03a', 'res-03', 'Levothyroxine', '50 mcg', 'Tablet', '1 tablet by mouth every morning on an empty stomach', PRESCRIBERS.nair, 'cycle', 30, 11, 7],
  ['med-03b', 'res-03', 'Sertraline', '50 mg', 'Tablet', '1 tablet by mouth once daily', PRESCRIBERS.nair, 'cycle', 30, 2, 10],
  ['med-03c', 'res-03', 'Polyethylene glycol 3350', '17 g', 'Powder packet', 'Mix 1 packet in 8 oz water once daily as needed for constipation', PRESCRIBERS.nair, 'prn', 14, 5, 12],

  ['med-04a', 'res-04', 'Furosemide', '20 mg', 'Tablet', '1 tablet by mouth every morning', PRESCRIBERS.hart, 'cycle', 30, 9, 6],
  ['med-04b', 'res-04', 'Insulin glargine', '100 units/mL', 'Prefilled pen', 'Inject 18 units under the skin at bedtime', PRESCRIBERS.hart, 'cycle', 28, 1, 310],
  ['med-04c', 'res-04', 'Glucose', '4 g', 'Chewable tablet', 'Chew 4 tablets if blood sugar below 70; recheck in 15 minutes', PRESCRIBERS.hart, 'prn', 30, 6, 8],

  ['med-05a', 'res-05', 'Memantine', '10 mg', 'Tablet', '1 tablet by mouth twice daily', PRESCRIBERS.nair, 'cycle', 30, 1, 22],
  ['med-05b', 'res-05', 'Quetiapine', '25 mg', 'Tablet', '1 tablet by mouth at bedtime', PRESCRIBERS.nair, 'cycle', 30, 17, 9],
  ['med-05c', 'res-05', 'Linezolid', '600 mg', 'Tablet', '1 tablet by mouth every 12 hours for 14 days', PRESCRIBERS.nair, 'course', 14, 0, 1850],
  ['med-05d', 'res-05', 'Acetaminophen', '325 mg', 'Tablet', '2 tablets by mouth every 6 hours as needed for pain or fever', PRESCRIBERS.nair, 'prn', 30, 21, 5],

  ['med-06a', 'res-06', 'Tamsulosin', '0.4 mg', 'Capsule', '1 capsule by mouth 30 minutes after the same meal daily', PRESCRIBERS.reyes, 'cycle', 30, 12, 13],
  ['med-06b', 'res-06', 'Lidocaine', '5%', 'Topical patch', 'Apply 1 patch to lower back for 12 hours, then remove for 12 hours', PRESCRIBERS.reyes, 'prn', 30, 0, 260],
  ['med-06c', 'res-06', 'Guaifenesin', '100 mg/5 mL', 'Oral liquid', '10 mL by mouth every 4 hours as needed for cough', PRESCRIBERS.reyes, 'prn', 10, 2, 7],

  ['med-07a', 'res-07', 'Amlodipine', '5 mg', 'Tablet', '1 tablet by mouth once daily', PRESCRIBERS.hart, 'cycle', 30, 1, 6],
  ['med-07b', 'res-07', 'Calcium carbonate + vitamin D3', '600 mg / 400 IU', 'Tablet', '1 tablet by mouth twice daily with meals', PRESCRIBERS.hart, 'cycle', 30, 19, 4],
  ['med-07c', 'res-07', 'Ipratropium-albuterol', '0.5 mg / 2.5 mg per 3 mL', 'Nebulizer vial', '1 vial via nebulizer every 6 hours as needed for wheezing', PRESCRIBERS.hart, 'prn', 15, 1, 38],

  ['med-08a', 'res-08', 'Metformin', '500 mg', 'Tablet', '1 tablet by mouth twice daily with meals', PRESCRIBERS.reyes, 'cycle', 30, 1, 5],
  ['med-08b', 'res-08', 'Lisinopril', '10 mg', 'Tablet', '1 tablet by mouth once daily. Hold if systolic BP below 100.', PRESCRIBERS.reyes, 'cycle', 30, 15, 5],
  ['med-08c', 'res-08', 'Docusate sodium', '100 mg', 'Capsule', '1 capsule by mouth twice daily as needed for constipation', PRESCRIBERS.reyes, 'prn', 30, 30, 5],

  ['med-09a', 'res-09', 'Losartan', '50 mg', 'Tablet', '1 tablet by mouth once daily', PRESCRIBERS.nair, 'cycle', 30, 13, 8],
  ['med-09b', 'res-09', 'Warfarin', '2.5 mg', 'Tablet', '1 tablet by mouth daily at 5 PM. Dose per INR.', PRESCRIBERS.nair, 'cycle', 30, 2, 9],
  ['med-09c', 'res-09', 'Docusate sodium', '100 mg', 'Capsule', '1 capsule by mouth daily as needed for constipation', PRESCRIBERS.nair, 'prn', 30, 24, 5],

  ['med-10a', 'res-10', 'Carbidopa-levodopa', '25 mg / 100 mg', 'Tablet', '1 tablet by mouth three times daily', PRESCRIBERS.hart, 'cycle', 30, 1, 28],
  ['med-10b', 'res-10', 'Mirtazapine', '15 mg', 'Tablet', '1 tablet by mouth at bedtime', PRESCRIBERS.hart, 'cycle', 30, 10, 9],
  ['med-10c', 'res-10', 'Melatonin', '3 mg', 'Tablet', '1 tablet by mouth at bedtime as needed for sleep', PRESCRIBERS.hart, 'prn', 30, 4, 4],
];

function buildMedications(now: number): Medication[] {
  return MED_ROWS.map(([id, residentId, name, strength, form, directions, prescriber, fillType, daysSupply, daysRemaining, costPerFill]) => ({
    id,
    residentId,
    name,
    strength,
    form,
    directions,
    prescriber,
    fillType,
    daysSupply,
    // Back-date the last fill so exactly `daysRemaining` days are left today
    // (the extra hour keeps us safely inside the day boundary).
    lastFilledAt: toIso(now - (daysSupply - daysRemaining) * DAY_MS - HOUR_MS),
    costPerFill,
  }));
}

function buildOrders(now: number): Order[] {
  const at = (msAgo: number) => toIso(now - msAgo);
  return [
    {
      id: 'ord-1003',
      residentId: 'res-09',
      medicationId: 'med-09b',
      priority: 'stat',
      note: 'INR 3.4 this morning. Prescriber reduced dose by phone.',
      submittedAt: at(55 * MINUTE_MS),
      submittedBy: NIGHT_NURSE,
      hold: {
        reason: 'renewal_needed',
        detail: 'Dose change needs a signed prescriber order',
        since: at(48 * MINUTE_MS),
      },
      processingStartedAt: null,
      history: [
        { at: at(55 * MINUTE_MS), label: 'Submitted (STAT)' },
        { at: at(48 * MINUTE_MS), label: 'On hold: dose change needs a signed prescriber order' },
      ],
    },
    {
      id: 'ord-1004',
      residentId: 'res-02',
      medicationId: 'med-02d',
      priority: 'stat',
      note: 'C. diff positive. Start therapy as soon as possible.',
      submittedAt: at(35 * MINUTE_MS),
      submittedBy: NIGHT_NURSE,
      approval: { state: 'pending', estimatedCost: 4200 },
      processingStartedAt: null,
      history: [
        { at: at(35 * MINUTE_MS), label: 'Submitted (STAT)' },
        { at: at(34 * MINUTE_MS), label: 'Sent for facility approval: high-cost medication' },
      ],
    },
    {
      id: 'ord-1001',
      residentId: 'res-03',
      medicationId: 'med-03b',
      priority: 'routine',
      submittedAt: at(5 * HOUR_MS),
      submittedBy: NIGHT_NURSE,
      hold: {
        reason: 'renewal_needed',
        detail: 'Prescription expired — needs prescriber renewal',
        since: at(4 * HOUR_MS + 40 * MINUTE_MS),
      },
      processingStartedAt: null,
      history: [
        { at: at(5 * HOUR_MS), label: 'Submitted' },
        { at: at(4 * HOUR_MS + 40 * MINUTE_MS), label: 'On hold: prescription expired — needs prescriber renewal' },
      ],
    },
    {
      id: 'ord-1002',
      residentId: 'res-06',
      medicationId: 'med-06b',
      priority: 'routine',
      submittedAt: at(DAY_MS + 2 * HOUR_MS),
      submittedBy: NIGHT_NURSE,
      hold: {
        reason: 'insurance_not_covered',
        detail: "Not covered by resident's Part D plan",
        since: at(DAY_MS + HOUR_MS),
      },
      processingStartedAt: null,
      history: [
        { at: at(DAY_MS + 2 * HOUR_MS), label: 'Submitted' },
        { at: at(DAY_MS + HOUR_MS), label: "On hold: not covered by resident's Part D plan" },
      ],
    },
    {
      id: 'ord-1005',
      residentId: 'res-05',
      medicationId: 'med-05c',
      priority: 'routine',
      note: 'New order after wound culture; infectious disease consult agrees.',
      submittedAt: at(2 * HOUR_MS),
      submittedBy: NIGHT_NURSE,
      approval: { state: 'pending', estimatedCost: 1850 },
      processingStartedAt: null,
      history: [
        { at: at(2 * HOUR_MS), label: 'Submitted' },
        { at: at(2 * HOUR_MS - MINUTE_MS), label: 'Sent for facility approval: high-cost medication' },
      ],
    },
    {
      id: 'ord-0991',
      residentId: 'res-08',
      medicationId: 'med-08c',
      priority: 'routine',
      submittedAt: at(DAY_MS + 3 * HOUR_MS),
      submittedBy: NIGHT_NURSE,
      processingStartedAt: at(DAY_MS + 3 * HOUR_MS),
      history: [{ at: at(DAY_MS + 3 * HOUR_MS), label: 'Submitted' }],
    },
    {
      id: 'ord-0990',
      residentId: 'res-04',
      medicationId: 'med-04c',
      priority: 'stat',
      note: 'Two hypoglycemic episodes overnight; supply running low.',
      submittedAt: at(DAY_MS + 5 * HOUR_MS),
      submittedBy: NIGHT_NURSE,
      processingStartedAt: at(DAY_MS + 5 * HOUR_MS),
      history: [{ at: at(DAY_MS + 5 * HOUR_MS), label: 'Submitted (STAT)' }],
    },
  ];
}

function buildDelivery(now: number): Delivery {
  const item = (id: string, residentId: string, description: string, quantity: string, handlingNote?: string): DeliveryItem => ({
    id,
    residentId,
    description,
    quantity,
    handlingNote,
    status: 'pending',
  });
  const dateKey = toDateKey(now).replace(/-/g, '');
  return {
    id: `dlv-${dateKey}`,
    packingSlipNumber: `PS-${dateKey}-014`,
    date: toIso(now),
    window: '2:00–4:00 PM',
    route: 'Route 4 · Willow Creek',
    items: [
      item('itm-1', 'res-01', 'Donepezil 10 mg tablet', '30 tablets (blister card)'),
      item('itm-2', 'res-01', 'Metoprolol tartrate 25 mg tablet', '60 tablets (blister card)'),
      item('itm-3', 'res-02', 'Atorvastatin 40 mg tablet', '30 tablets (blister card)'),
      item('itm-4', 'res-04', 'Insulin glargine 100 units/mL pen', '5 pens', 'Refrigerate on arrival'),
      item('itm-5', 'res-05', 'Memantine 10 mg tablet', '60 tablets (blister card)'),
      item('itm-6', 'res-07', 'Amlodipine 5 mg tablet', '30 tablets (blister card)'),
      item('itm-7', 'res-08', 'Metformin 500 mg tablet', '60 tablets (blister card)'),
      item('itm-8', 'res-10', 'Carbidopa-levodopa 25/100 mg tablet', '90 tablets (blister card)'),
    ],
  };
}

function buildAudit(now: number): AuditEntry[] {
  const at = (msAgo: number) => toIso(now - msAgo);
  // Newest first, matching how the API returns the log.
  return [
    { id: 'aud-007', at: at(48 * MINUTE_MS), user: PHARMACIST, action: 'order_held', summary: 'Held Warfarin 2.5 mg for Irene Castellano: dose change needs a signed prescriber order' },
    { id: 'aud-006', at: at(55 * MINUTE_MS), user: NIGHT_NURSE, action: 'refill_requested', summary: 'Requested Warfarin 2.5 mg for Irene Castellano (STAT)' },
    { id: 'aud-005', at: at(35 * MINUTE_MS + 30 * 1000), user: NIGHT_NURSE, action: 'refill_requested', summary: 'Requested Fidaxomicin 200 mg for Harold Brennan (STAT) — needs facility approval' },
    { id: 'aud-004', at: at(2 * HOUR_MS), user: NIGHT_NURSE, action: 'refill_requested', summary: 'Requested Linezolid 600 mg for Margaret Lindqvist — needs facility approval' },
    { id: 'aud-003', at: at(4 * HOUR_MS + 40 * MINUTE_MS), user: PHARMACIST, action: 'order_held', summary: 'Held Sertraline 50 mg for Dorothy Kessler: prescription expired' },
    { id: 'aud-002', at: at(DAY_MS + HOUR_MS), user: PHARMACIST, action: 'order_held', summary: "Held Lidocaine 5% for Franklin DeLuca: not covered by Part D plan" },
    { id: 'aud-001', at: at(DAY_MS - 3 * HOUR_MS), user: NIGHT_NURSE, action: 'delivery_confirmed', summary: 'Confirmed delivery PS-013: 9 items received, no issues' },
  ].sort((a, b) => b.at.localeCompare(a.at)) as AuditEntry[];
}

export function createSeedData(now: number): DemoDatabase {
  return {
    seededOn: toDateKey(now),
    facility,
    residents,
    medications: buildMedications(now),
    orders: buildOrders(now),
    delivery: buildDelivery(now),
    audit: buildAudit(now),
  };
}
