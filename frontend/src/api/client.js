/**
 * API Client
 * Owner: Sirat
 * Requirement: FRONTEND_SPEC Section 7 & API_SPEC Section 1
 * Handles the Supabase bearer token and the standard error format.
 * Live backend only: the in-browser mock database has been removed.
 */

import { supabase } from '../lib/supabase';

export class ApiError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function currentAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Universal API request handler
 */
export async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', body, token = null } = options;

  const accessToken = token ?? (await currentAccessToken());
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
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
