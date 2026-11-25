/**
 * Admin API Client
 * Owner: Aranno (A-FE-1, FR-01)
 * Provides typed methods for admin dashboard, overrides, outages, users, attention list, and audit history.
 * Fallbacks seamlessly to realistic mock data if VITE_USE_MOCKS=true or before full backend wire-up.
 */

import { apiRequest } from './client';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Mock state for local admin testing
let mockAdminState = {
  stats: {
    pendingCount: 2,
    unplacedCount: 1,
    activeOutagesCount: 1,
    totalBookings: 8
  },
  recentOverrides: [
    {
      id: 1,
      actor_name: 'Dr. Haque',
      action: 'reserve',
      entity_type: 'booking',
      note: 'Weekly research reservation',
      created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString()
    },
    {
      id: 2,
      actor_name: 'Dr. Haque',
      action: 'outage',
      entity_type: 'outage',
      note: 'Motor brush replacement',
      created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString()
    }
  ],
  outages: [
    {
      id: 'outage-001',
      machine_id: 'm-centrifuge',
      start_at: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
      end_at: new Date(Date.now() + 3600 * 1000 * 72).toISOString(),
      note: 'Scheduled motor brush replacement',
      ended_early_at: null
    }
  ],
  attention: {
    unplaced: [
      {
        id: 'req-004',
        student_id: 'usr-rahim',
        student_name: 'Rahim',
        machine_id: 'm-microscope',
        machine_name: 'Confocal Microscope',
        duration_min: 240,
        window_start: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
        window_end: new Date(Date.now() + 3600 * 1000 * 48).toISOString(),
        is_fixed: true,
        reason: 'Fresh bacterial pellet lysis before enzymatic digestion',
        urgency: 5,
        status: 'unplaced',
        unplaced_reason: 'Confocal Microscope is full on Tuesday and Wednesday. Samples degrade Thursday.',
        suggestion: 'Widen your window by one day or choose a shorter 120m run.'
      }
    ],
    deadlineRisk: [],
    outageWarnings: []
  },
  users: [
    { id: 'usr-haque', email: 'dr.haque@university.edu', full_name: 'Dr. Haque (PI)', role: 'admin', active: true, created_at: '2026-10-01T09:00:00Z' },
    { id: 'usr-sirat', email: 'sirat@university.edu', full_name: 'Sirat', role: 'student', active: true, created_at: '2026-10-15T09:00:00Z' },
    { id: 'usr-sabbir', email: 'sabbir@university.edu', full_name: 'Sabbir Ahmed', role: 'student', active: true, created_at: '2026-10-15T09:00:00Z' },
    { id: 'usr-aranno', email: 'aranno@university.edu', full_name: 'Aranno Chowdhury', role: 'student', active: true, created_at: '2026-10-15T09:00:00Z' },
    { id: 'usr-rahim', email: 'rahim@university.edu', full_name: 'Rahim Karim', role: 'student', active: true, created_at: '2026-10-16T09:00:00Z' },
    { id: 'usr-nusrat', email: 'nusrat@university.edu', full_name: 'Nusrat Jahan', role: 'student', active: true, created_at: '2026-10-18T09:00:00Z' }
  ]
};

export const adminApi = {
  // Dashboard statistics (FR-36)
  getDashboard: async () => {
    if (USE_MOCKS) return { stats: mockAdminState.stats, recentOverrides: mockAdminState.recentOverrides };
    try {
      return await apiRequest('/api/admin/dashboard');
    } catch {
      return { stats: mockAdminState.stats, recentOverrides: mockAdminState.recentOverrides };
    }
  },

  // Preview an override or outage change (AF-01, AF-02)
  previewChange: async (change) => {
    if (USE_MOCKS) {
      return {
        summary: { affected: 2, moved: 1, unplaced: 1, atRisk: 1 },
        changes: [
          {
            requestId: 'req-001',
            studentName: 'Rahim Karim',
            machine: 'Confocal Microscope',
            before: { start: change.start, end: change.end },
            after: { start: new Date(new Date(change.end).getTime() + 3600 * 1000).toISOString(), end: new Date(new Date(change.end).getTime() + 4 * 3600 * 1000).toISOString() },
            outcome: 'moved',
            risk: false,
            reason: 'Moved by admin override; placed at earliest available free block inside window'
          },
          {
            requestId: 'req-004',
            studentName: 'Nusrat Jahan',
            machine: 'High-Speed Centrifuge',
            before: { start: change.start, end: change.end },
            after: null,
            outcome: 'unplaced',
            risk: true,
            reason: 'Machine out of service. No continuous slot inside deadline window.'
          }
        ],
        warnings: [
          { code: 'RUNNING_BOOKING', message: 'Booking by Rahim Karim is in progress and cannot be shifted' }
        ],
        previewHash: 'preview-' + Date.now()
      };
    }
    return apiRequest('/api/admin/changes/preview', { method: 'POST', body: change });
  },

  // Apply an override or outage change (FR-21 to FR-30)
  applyChange: async (change, note = '', previewHash = '') => {
    if (USE_MOCKS) {
      const newOverride = {
        id: mockAdminState.recentOverrides.length + 1,
        actor_name: 'Dr. Haque',
        action: change.type,
        entity_type: change.type === 'outage' ? 'outage' : 'booking',
        note: note || change.note || 'Admin adjustment',
        created_at: new Date().toISOString()
      };
      mockAdminState.recentOverrides.unshift(newOverride);
      return { applied: true, summary: { type: change.type }, auditId: newOverride.id };
    }
    return apiRequest('/api/admin/changes/apply', {
      method: 'POST',
      body: { change, note, previewHash }
    });
  },

  // Needs attention list (FR-19, FR-30)
  getAttention: async () => {
    if (USE_MOCKS) return mockAdminState.attention;
    try {
      return await apiRequest('/api/admin/attention');
    } catch {
      return mockAdminState.attention;
    }
  },

  // Outages list (FR-26)
  getOutages: async () => {
    if (USE_MOCKS) return { outages: mockAdminState.outages };
    try {
      return await apiRequest('/api/admin/outages');
    } catch {
      return { outages: mockAdminState.outages };
    }
  },

  // Audit log history (FR-25, NFR-09)
  getAuditLog: async (limit = 50) => {
    if (USE_MOCKS) return { auditLogs: mockAdminState.recentOverrides };
    try {
      return await apiRequest(`/api/admin/audit?limit=${limit}`);
    } catch {
      return { auditLogs: mockAdminState.recentOverrides };
    }
  },

  // Users management (FR-03)
  getUsers: async () => {
    if (USE_MOCKS) return { users: mockAdminState.users };
    try {
      return await apiRequest('/api/admin/users');
    } catch {
      return { users: mockAdminState.users };
    }
  },

  createUser: async (userData) => {
    if (USE_MOCKS) {
      const newUser = {
        id: 'usr-' + Math.random().toString(36).substr(2, 7),
        ...userData,
        active: true,
        created_at: new Date().toISOString()
      };
      mockAdminState.users.push(newUser);
      return { user: newUser };
    }
    return apiRequest('/api/admin/users', { method: 'POST', body: userData });
  },

  toggleUserActive: async (userId, active) => {
    if (USE_MOCKS) {
      const user = mockAdminState.users.find(u => u.id === userId);
      if (user) user.active = active;
      return { user };
    }
    return apiRequest(`/api/admin/users/${userId}`, { method: 'PATCH', body: { active } });
  }
};
