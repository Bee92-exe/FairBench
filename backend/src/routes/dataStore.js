/**
 * In-memory Data Store & Fallback Services
 * Owner: Aranno (A-BE-3, A-BE-4)
 * Complies with API_SPEC.md, SYSTEM_DESIGN.md and ERD.md.
 * Provides full state management when working before or alongside database services.
 */

import { AppError } from '../middleware/errors.js';

const now = new Date();
const getFutureDate = (daysAhead, hours, minutes = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

export const machines = [
  {
    id: 'm-microscope',
    name: 'Confocal Microscope',
    status: 'working',
    buffer_minutes: 10,
    reliability_note: null,
    currentOutage: null
  },
  {
    id: 'm-centrifuge',
    name: 'High-Speed Centrifuge',
    status: 'working',
    buffer_minutes: 10,
    reliability_note: null,
    currentOutage: null
  },
  {
    id: 'm-spectrophotometer',
    name: 'UV-Vis Spectrophotometer',
    status: 'working',
    buffer_minutes: 20,
    reliability_note: 'Slow and temperamental. Extra buffer reserved after each run',
    currentOutage: null
  }
];

export const users = [
  { id: 'usr-admin', email: 'drhaque@lab.test', full_name: 'Dr. Haque', role: 'admin', active: true, created_at: getFutureDate(-30, 9) },
  { id: 'usr-rahim', email: 'rahim@lab.test', full_name: 'Rahim', role: 'student', active: true, created_at: getFutureDate(-20, 9) },
  { id: 'usr-nusrat', email: 'nusrat@lab.test', full_name: 'Nusrat', role: 'student', active: true, created_at: getFutureDate(-15, 9) },
  { id: 'usr-sirat', email: 'sirat@lab.test', full_name: 'Sirat', role: 'student', active: true, created_at: getFutureDate(-10, 9) },
  { id: 'usr-aranno', email: 'aranno@lab.test', full_name: 'Aranno', role: 'student', active: true, created_at: getFutureDate(-10, 9) },
  { id: 'usr-inactive', email: 'inactive@lab.test', full_name: 'Inactive Student', role: 'student', active: false, created_at: getFutureDate(-5, 9) }
];

export let requests = [
  {
    id: 'req-001',
    student_id: 'usr-rahim',
    student_name: 'Rahim',
    machine_id: 'm-microscope',
    duration_min: 180,
    window_start: getFutureDate(1, 9, 0),
    window_end: getFutureDate(2, 17, 0),
    is_fixed: true,
    reason: 'Samples expire Thursday',
    urgency: 5,
    status: 'scheduled',
    score: 85.0,
    score_breakdown: { deadline: 40, tightness: 25, waiting: 10, fairness: 10 },
    unplaced_reason: null,
    suggestion: null,
    created_at: getFutureDate(-1, 10, 0)
  },
  {
    id: 'req-002',
    student_id: 'usr-nusrat',
    student_name: 'Nusrat',
    machine_id: 'm-centrifuge',
    duration_min: 20,
    window_start: getFutureDate(1, 9, 0),
    window_end: getFutureDate(5, 17, 0),
    is_fixed: false,
    reason: 'Routine prep',
    urgency: 2,
    status: 'scheduled',
    score: 42.0,
    score_breakdown: { deadline: 10, tightness: 12, waiting: 10, fairness: 10 },
    unplaced_reason: null,
    suggestion: null,
    created_at: getFutureDate(-1, 11, 0)
  },
  {
    id: 'req-003',
    student_id: 'usr-sirat',
    student_name: 'Sirat',
    machine_id: 'm-spectrophotometer',
    duration_min: 120,
    window_start: getFutureDate(2, 9, 0),
    window_end: getFutureDate(3, 17, 0),
    is_fixed: false,
    reason: 'Enzyme kinetics',
    urgency: 3,
    status: 'waiting',
    score: 55.0,
    score_breakdown: { deadline: 20, tightness: 15, waiting: 10, fairness: 10 },
    unplaced_reason: null,
    suggestion: null,
    created_at: getFutureDate(-1, 12, 0)
  },
  {
    id: 'req-004',
    student_id: 'usr-rahim',
    student_name: 'Rahim',
    machine_id: 'm-microscope',
    duration_min: 240,
    window_start: getFutureDate(3, 9, 0),
    window_end: getFutureDate(3, 13, 0),
    is_fixed: true,
    reason: 'Time-critical assay',
    urgency: 5,
    status: 'unplaced',
    score: 75.0,
    score_breakdown: { deadline: 40, tightness: 25, waiting: 5, fairness: 5 },
    unplaced_reason: 'Microscope is full on Thursday. Your samples expire Thursday, so Dr. Haque needs to decide',
    suggestion: 'Widen your window by one day or choose a shorter run',
    created_at: getFutureDate(-1, 14, 0)
  }
];

export let bookings = [
  {
    id: 'book-001',
    request_id: 'req-001',
    machine_id: 'm-microscope',
    student_id: 'usr-rahim',
    student_name: 'Rahim',
    kind: 'student',
    start_at: getFutureDate(1, 10, 0),
    end_at: getFutureDate(1, 13, 0),
    occupied_until: getFutureDate(1, 13, 10),
    pinned: false,
    set_by: 'system',
    status: 'active',
    reason: 'Placed Tuesday 10:00: earliest free slot inside your window. You were placed early because you had only two possible days',
    created_at: getFutureDate(-1, 10, 5)
  },
  {
    id: 'book-002',
    request_id: 'req-002',
    machine_id: 'm-centrifuge',
    student_id: 'usr-nusrat',
    student_name: 'Nusrat',
    kind: 'student',
    start_at: getFutureDate(1, 14, 0),
    end_at: getFutureDate(1, 14, 20),
    occupied_until: getFutureDate(1, 14, 30),
    pinned: false,
    set_by: 'system',
    status: 'active',
    reason: 'Placed Tuesday 14:00: earliest free slot inside your window',
    created_at: getFutureDate(-1, 11, 5)
  },
  {
    id: 'book-pi-001',
    request_id: null,
    machine_id: 'm-microscope',
    student_id: 'usr-admin',
    student_name: 'Dr. Haque',
    kind: 'pi_reserved',
    start_at: getFutureDate(2, 9, 0),
    end_at: getFutureDate(2, 12, 0),
    occupied_until: getFutureDate(2, 12, 10),
    pinned: true,
    set_by: 'admin',
    status: 'active',
    reason: 'PI reserved for lab project imaging',
    created_at: getFutureDate(-5, 9, 0)
  }
];

export let outages = [
  {
    id: 'outage-001',
    machine_id: 'm-centrifuge',
    start_at: getFutureDate(4, 9, 0),
    end_at: getFutureDate(5, 17, 0),
    note: 'Scheduled motor brush replacement',
    ended_early_at: null,
    created_by: 'usr-admin',
    created_at: getFutureDate(-2, 10, 0)
  }
];

export let auditLogs = [
  {
    id: 1,
    actor_id: 'usr-admin',
    actor_name: 'Dr. Haque',
    action: 'reserve',
    entity_type: 'booking',
    entity_id: 'book-pi-001',
    details: { machine: 'Confocal Microscope', durationMin: 180 },
    note: 'Weekly research reservation',
    created_at: getFutureDate(-5, 9, 0)
  },
  {
    id: 2,
    actor_id: 'usr-admin',
    actor_name: 'Dr. Haque',
    action: 'outage',
    entity_type: 'outage',
    entity_id: 'outage-001',
    details: { machine: 'High-Speed Centrifuge', durationDays: 2 },
    note: 'Motor brush replacement',
    created_at: getFutureDate(-2, 10, 0)
  }
];
