/**
 * Mock Database and State Manager
 * Strictly conforms to docs/API_SPEC.md and docs/SYSTEM_DESIGN.md
 * Provides fully realistic, interactive data when VITE_USE_MOCKS=true
 */

import { MACHINES, LAB_TIMEZONE } from '../lib/constants';

// Initial state
const INITIAL_SETTINGS = {
  lab_name: "Dr. Haque's Biophysics & Nanoscopy Lab",
  opening_time: "08:00",
  closing_time: "20:00",
  slot_minutes: 15,
  timezone: LAB_TIMEZONE,
  show_names: true,
  weekly_quota_hours: 12,
  open_requests_limit: 3,
  score_weights: {
    deadline: 0.40,
    tightness: 0.25,
    waiting: 0.15,
    fairness: 0.20
  }
};

const INITIAL_PROFILES = [
  { id: 'usr-sirat', email: 'sirat@university.edu', name: 'Sirat (You)', role: 'student', weeklyHoursUsed: 4.5, openRequestsCount: 2 },
  { id: 'usr-sabbir', email: 'sabbir@university.edu', name: 'Sabbir Ahmed', role: 'student', weeklyHoursUsed: 6.0, openRequestsCount: 1 },
  { id: 'usr-aranno', email: 'aranno@university.edu', name: 'Aranno Chowdhury', role: 'student', weeklyHoursUsed: 3.0, openRequestsCount: 1 },
  { id: 'usr-rahim', email: 'rahim@university.edu', name: 'Rahim Karim', role: 'student', weeklyHoursUsed: 7.5, openRequestsCount: 1 },
  { id: 'usr-haque', email: 'dr.haque@university.edu', name: 'Dr. Haque (PI)', role: 'admin', weeklyHoursUsed: 0, openRequestsCount: 0 }
];

// Helper to generate dynamic dates relative to today
const today = new Date();
const getFutureDate = (daysAhead, hours, minutes = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

let settings = { ...INITIAL_SETTINGS };
let currentUser = { ...INITIAL_PROFILES[0] }; // Default to Sirat

let requests = [
  {
    id: 'req-001',
    userId: 'usr-sirat',
    machineId: 'm-microscope',
    durationMin: 180,
    windowStart: getFutureDate(1, 9, 0),
    windowEnd: getFutureDate(2, 18, 0),
    isFixed: true,
    reason: 'Fluorescence samples degrade rapidly after 48h fixation',
    urgency: 5,
    status: 'scheduled',
    score: 82.5,
    scoreBreakdown: { deadline: 40, tightness: 25, waiting: 7.5, fairness: 10 },
    createdAt: getFutureDate(-1, 10, 0),
    bookingId: 'book-001',
    booking: {
      id: 'book-001',
      machineId: 'm-microscope',
      start: getFutureDate(1, 10, 0),
      end: getFutureDate(1, 13, 0),
      occupiedUntil: getFutureDate(1, 13, 15),
      pinned: false,
      reason: 'Placed at earliest free slot inside window. Priority boosted by tight 48h deadline.'
    }
  },
  {
    id: 'req-002',
    userId: 'usr-sirat',
    machineId: 'm-spectrophotometer',
    durationMin: 120,
    windowStart: getFutureDate(2, 10, 0),
    windowEnd: getFutureDate(3, 16, 0),
    isFixed: false,
    reason: 'Standard kinetic optical density measurement curve',
    urgency: 2,
    status: 'waiting',
    score: 45.0,
    scoreBreakdown: { deadline: 10, tightness: 15, waiting: 10, fairness: 10 },
    createdAt: getFutureDate(0, 8, 30),
    booking: null
  },
  {
    id: 'req-003',
    userId: 'usr-sirat',
    machineId: 'm-centrifuge',
    durationMin: 240,
    windowStart: getFutureDate(3, 9, 0),
    windowEnd: getFutureDate(3, 15, 0),
    isFixed: true,
    reason: 'Fresh bacterial pellet lysis before enzymatic digestion',
    urgency: 4,
    status: 'unplaced',
    unplacedReason: 'Centrifuge has scheduled maintenance overhaul during requested window. No continuous 240m block free.',
    suggestion: 'Widen window to include Friday morning or reduce duration to 120m.',
    score: 68.0,
    scoreBreakdown: { deadline: 30, tightness: 20, waiting: 8, fairness: 10 },
    createdAt: getFutureDate(-1, 14, 0),
    booking: null
  }
];

let outages = [
  {
    id: 'out-001',
    machineId: 'm-centrifuge',
    start: getFutureDate(3, 8, 0),
    end: getFutureDate(3, 18, 0),
    note: 'Scheduled rotor safety inspection & bearing replacement'
  }
];

let otherBookings = [
  {
    id: 'book-101',
    machineId: 'm-microscope',
    start: getFutureDate(1, 14, 0),
    end: getFutureDate(1, 17, 0),
    occupiedUntil: getFutureDate(1, 17, 15),
    kind: 'student',
    userId: 'usr-sabbir',
    label: 'Sabbir Ahmed',
    pinned: false
  },
  {
    id: 'book-102',
    machineId: 'm-microscope',
    start: getFutureDate(2, 9, 0),
    end: getFutureDate(2, 12, 0),
    occupiedUntil: getFutureDate(2, 12, 15),
    kind: 'pi_reserved',
    userId: 'usr-haque',
    label: 'PI Reserved',
    pinned: true
  },
  {
    id: 'book-103',
    machineId: 'm-centrifuge',
    start: getFutureDate(1, 11, 0),
    end: getFutureDate(1, 13, 0),
    occupiedUntil: getFutureDate(1, 13, 15),
    kind: 'student',
    userId: 'usr-rahim',
    label: 'Rahim Karim',
    pinned: false
  }
];

let notifications = [
  {
    id: 'notif-001',
    userId: 'usr-sirat',
    title: 'Booking Confirmed: Confocal Microscope',
    message: 'Your request #req-001 has been scheduled for tomorrow at 10:00 AM (Dhaka time).',
    type: 'scheduled',
    read: false,
    createdAt: getFutureDate(0, -2, 0),
    relatedId: 'req-001'
  },
  {
    id: 'notif-002',
    userId: 'usr-sirat',
    title: 'Attention: Centrifuge Request Unplaced',
    message: 'Your 240m centrifuge request could not be placed due to maintenance. Review suggestion.',
    type: 'unplaced',
    read: false,
    createdAt: getFutureDate(0, -5, 0),
    relatedId: 'req-003'
  },
  {
    id: 'notif-003',
    userId: 'usr-sirat',
    title: 'Lab Policy Notice',
    message: 'Spectrophotometer requires 30 min buffer after each run to ensure thermal equilibrium.',
    type: 'info',
    read: true,
    createdAt: getFutureDate(-2, 9, 0)
  }
];

export const mockDb = {
  getCurrentUser() {
    return currentUser;
  },

  setCurrentUser(userOrRole) {
    if (typeof userOrRole === 'string') {
      currentUser = INITIAL_PROFILES.find(p => p.role === userOrRole || p.id === userOrRole) || INITIAL_PROFILES[0];
    } else {
      currentUser = userOrRole;
    }
    return currentUser;
  },

  getProfiles() {
    return INITIAL_PROFILES;
  },

  getSettings() {
    return { ...settings };
  },

  updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    return { ...settings };
  },

  getMachines() {
    return MACHINES.map(m => {
      const activeOutage = outages.find(o => o.machineId === m.id);
      return {
        ...m,
        status: activeOutage ? 'out_of_service' : 'operational',
        currentOutage: activeOutage || null
      };
    });
  },

  getMyRequests() {
    return requests.filter(r => r.userId === currentUser.id);
  },

  createRequest(data) {
    const machine = MACHINES.find(m => m.id === data.machineId);
    const newId = `req-${Date.now().toString().slice(-4)}`;
    
    // Simulate fair priority score calculation
    // FR-38: score = 0.4*deadline + 0.25*tightness + 0.15*waiting + 0.2*fairness
    const score = Math.min(95, Math.max(30, (data.urgency * 15) + (data.isFixed ? 15 : 5)));
    
    // Check if slot can be placed immediately (simulated scheduling)
    const isPlacable = !data.reason?.toLowerCase().includes('fail');
    
    let newRequest;
    if (isPlacable) {
      const bookingStart = new Date(data.windowStart);
      bookingStart.setHours(bookingStart.getHours() + 1); // Earliest available 1hr in
      const bookingEnd = new Date(bookingStart.getTime() + (data.durationMin * 60000));
      const bufferMin = machine?.bufferMin || 15;
      const occupiedUntil = new Date(bookingEnd.getTime() + (bufferMin * 60000));

      const newBooking = {
        id: `book-${Date.now().toString().slice(-4)}`,
        machineId: data.machineId,
        start: bookingStart.toISOString(),
        end: bookingEnd.toISOString(),
        occupiedUntil: occupiedUntil.toISOString(),
        pinned: false,
        reason: `Placed at earliest free slot inside your window (${new Date(bookingStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LAB_TIMEZONE })}). Duration ${data.durationMin}m + ${bufferMin}m buffer guaranteed.`
      };

      newRequest = {
        id: newId,
        userId: currentUser.id,
        ...data,
        status: 'scheduled',
        score,
        scoreBreakdown: {
          deadline: Math.round(score * 0.4),
          tightness: Math.round(score * 0.25),
          waiting: Math.round(score * 0.15),
          fairness: Math.round(score * 0.20)
        },
        createdAt: new Date().toISOString(),
        bookingId: newBooking.id,
        booking: newBooking
      };

      // Add to notifications
      notifications.unshift({
        id: `notif-${Date.now()}`,
        userId: currentUser.id,
        title: `Booking Confirmed: ${machine?.name}`,
        message: `Your run has been scheduled from ${new Date(bookingStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LAB_TIMEZONE })} to ${new Date(bookingEnd).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LAB_TIMEZONE })}.`,
        type: 'scheduled',
        read: false,
        createdAt: new Date().toISOString(),
        relatedId: newId
      });
    } else {
      newRequest = {
        id: newId,
        userId: currentUser.id,
        ...data,
        status: 'unplaced',
        score,
        scoreBreakdown: {
          deadline: Math.round(score * 0.4),
          tightness: Math.round(score * 0.25),
          waiting: 0,
          fairness: Math.round(score * 0.20)
        },
        unplacedReason: `${machine?.name} is fully booked during this specific window.`,
        suggestion: 'Try widening your window by 24 hours or adjusting your requested duration.',
        createdAt: new Date().toISOString(),
        booking: null
      };
    }

    requests.unshift(newRequest);
    return newRequest;
  },

  cancelRequest(id) {
    const req = requests.find(r => r.id === id);
    if (!req) throw new Error('Request not found');
    req.status = 'cancelled';
    req.booking = null;

    notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: currentUser.id,
      title: 'Booking Cancelled',
      message: `Your booking for request #${id} has been cancelled and released for other students.`,
      type: 'cancelled',
      read: false,
      createdAt: new Date().toISOString()
    });

    return req;
  },

  getSchedule(machineId) {
    // Gather all blocks for this machine
    const blocks = [];

    // From active requests with bookings
    requests.forEach(r => {
      if (r.booking && r.machineId === machineId && r.status === 'scheduled') {
        const isMine = r.userId === currentUser.id;
        blocks.push({
          id: r.booking.id,
          requestId: r.id,
          kind: 'student',
          label: (settings.show_names || isMine || currentUser.role === 'admin')
            ? (isMine ? 'Sirat (You)' : 'Student Booking')
            : 'Occupied',
          start: r.booking.start,
          end: r.booking.end,
          occupiedUntil: r.booking.occupiedUntil,
          isMine,
          reason: r.booking.reason
        });
      }
    });

    // From other pre-existing bookings
    otherBookings.forEach(b => {
      if (b.machineId === machineId) {
        blocks.push({
          id: b.id,
          kind: b.kind,
          label: (settings.show_names || currentUser.role === 'admin') ? b.label : (b.kind === 'pi_reserved' ? 'PI Reserved' : 'Occupied'),
          start: b.start,
          end: b.end,
          occupiedUntil: b.occupiedUntil,
          isMine: b.userId === currentUser.id
        });
      }
    });

    const machineOutages = outages.filter(o => o.machineId === machineId);

    return {
      machineId,
      blocks,
      outages: machineOutages
    };
  },

  getNotifications(unreadOnly = false) {
    let list = notifications.filter(n => n.userId === currentUser.id);
    if (unreadOnly) {
      list = list.filter(n => !n.read);
    }
    return list;
  },

  markNotificationRead(id) {
    const notif = notifications.find(n => n.id === id);
    if (notif) notif.read = true;
    return { success: true };
  },

  markAllNotificationsRead() {
    notifications.forEach(n => {
      if (n.userId === currentUser.id) n.read = true;
    });
    return { success: true };
  },

  getHealth() {
    return {
      status: 'ok',
      db: true,
      version: '1.0.0',
      uptime: process.uptime ? process.uptime() : 1240,
      timestamp: new Date().toISOString()
    };
  }
};
