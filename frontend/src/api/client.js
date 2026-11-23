/**
 * API Client
 * Owner: Sirat
 * Requirement: FRONTEND_SPEC Section 7 & API_SPEC Section 1
 * Handles Bearer token, standard error parsing into ApiError, and mock routing
 */

import { mockDb } from '../mocks/mockDb';

export class ApiError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Universal API Request Handler
 */
export async function apiRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    body,
    token = null,
    delayMs = 150
  } = options;

  // If in mock mode, route via Mock DB
  if (USE_MOCKS) {
    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }

    try {
      return handleMockEndpoint(endpoint, method, body);
    } catch (err) {
      throw err instanceof ApiError ? err : new ApiError('MOCK_ERROR', err.message);
    }
  }

  // Real backend request
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      // Trigger login redirect if unauthorized
      window.dispatchEvent(new CustomEvent('unauthorized'));
    }

    const errObj = data?.error || {
      code: 'REQUEST_FAILED',
      message: response.statusText || 'Request failed',
      details: []
    };

    throw new ApiError(errObj.code, errObj.message, errObj.details);
  }

  return data;
}

/**
 * Mock Request Router matching API_SPEC.md exactly
 */
function handleMockEndpoint(endpoint, method, body) {
  const url = new URL(endpoint, 'http://localhost');
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // GET /api/me
  if (pathname === '/api/me' && method === 'GET') {
    return { user: mockDb.getCurrentUser() };
  }

  // GET /api/machines
  if (pathname === '/api/machines' && method === 'GET') {
    return { machines: mockDb.getMachines() };
  }

  // GET /api/settings
  if (pathname === '/api/settings' && method === 'GET') {
    return { settings: mockDb.getSettings() };
  }

  // PUT /api/settings
  if (pathname === '/api/settings' && method === 'PUT') {
    return { settings: mockDb.updateSettings(body) };
  }

  // GET /api/requests/mine
  if ((pathname === '/api/requests/mine' || pathname === '/api/bookings/mine') && method === 'GET') {
    return { requests: mockDb.getMyRequests() };
  }

  // POST /api/requests
  if (pathname === '/api/requests' && method === 'POST') {
    if (!body.machineId || !body.durationMin || !body.windowStart || !body.windowEnd) {
      throw new ApiError('VALIDATION_ERROR', 'Missing required scheduling fields');
    }
    const created = mockDb.createRequest(body);
    return {
      request: created,
      booking: created.booking
    };
  }

  // POST /api/requests/:id/cancel
  if (pathname.startsWith('/api/requests/') && pathname.endsWith('/cancel') && method === 'POST') {
    const parts = pathname.split('/');
    const id = parts[3];
    return { request: mockDb.cancelRequest(id) };
  }

  // GET /api/schedule
  if (pathname === '/api/schedule' && method === 'GET') {
    const machineId = searchParams.get('machineId') || 'm-microscope';
    return mockDb.getSchedule(machineId);
  }

  // GET /api/notifications
  if (pathname === '/api/notifications' && method === 'GET') {
    const unreadOnly = searchParams.get('unread') === 'true';
    return { notifications: mockDb.getNotifications(unreadOnly) };
  }

  // POST /api/notifications/:id/read
  if (pathname.startsWith('/api/notifications/') && pathname.endsWith('/read') && method === 'POST') {
    const parts = pathname.split('/');
    const id = parts[3];
    return mockDb.markNotificationRead(id);
  }

  // POST /api/notifications/read-all
  if (pathname === '/api/notifications/read-all' && method === 'POST') {
    return mockDb.markAllNotificationsRead();
  }

  // GET /api/health
  if (pathname === '/api/health' && method === 'GET') {
    return mockDb.getHealth();
  }

  throw new ApiError('NOT_FOUND', `Mock endpoint ${method} ${pathname} not found`);
}
