import adminApi from './adminApi';

// Simple circuit breaker to avoid endless 404 spam if backend route missing
let failureCount = 0;
let circuitOpen = false;
let circuitOpenedAt = 0;
const CIRCUIT_TIMEOUT = 60000; // 60s pause after repeated failures

function buildQs({ unreadOnly, limit }) {
  const params = [];
  if (unreadOnly) params.push('unread=1');
  if (limit) params.push(`limit=${limit}`);
  return params.length ? `?${params.join('&')}` : '';
}

async function tryEndpoints(method, paths, data) {
  let lastErr;
  for (const p of paths) {
    try {
      // eslint-disable-next-line no-console
      console.log('[notificationsApi] trying', method.toUpperCase(), p);
      if (method === 'get') return await adminApi.get(p);
      if (method === 'patch') return await adminApi.patch(p, data);
      if (method === 'delete') return await adminApi.delete(p);
    } catch (e) {
      if (e.response && e.response.status === 404) {
        // eslint-disable-next-line no-console
        console.warn('[notificationsApi] 404 on', p, 'trying next if any');
        lastErr = e; // try next path
        continue;
      }
      // eslint-disable-next-line no-console
      console.error('[notificationsApi] error non-404', p, e.response?.status, e.message);
      throw e;
    }
  }
  // eslint-disable-next-line no-console
  console.error('[notificationsApi] all endpoints failed', paths.map(x=>x).join(','));
  failureCount++;
  if (!circuitOpen && failureCount >= 3) {
    circuitOpen = true;
    circuitOpenedAt = Date.now();
    console.warn('[notificationsApi] circuit OPENED (suppressing further attempts for', CIRCUIT_TIMEOUT/1000, 's)');
  }
  throw lastErr || new Error('All notification endpoints failed');
}

export const fetchNotifications = async ({ unreadOnly = false, limit = 50 } = {}) => {
  if (circuitOpen) {
    if (Date.now() - circuitOpenedAt < CIRCUIT_TIMEOUT) {
      return [];
    } else {
      // reset circuit
      circuitOpen = false; failureCount = 0;
    }
  }
  const qs = buildQs({ unreadOnly, limit });
  const res = await tryEndpoints('get', [`/api/admin/notifications${qs}`, `/admin/notifications${qs}`]);
  // success -> reset failure counters
  failureCount = 0; circuitOpen = false;
  return res.data.notifications || [];
};

export const markNotificationRead = async (id) => {
  if (circuitOpen && Date.now() - circuitOpenedAt < CIRCUIT_TIMEOUT) return null;
  const res = await tryEndpoints('patch', [`/api/admin/notifications/${id}/read`, `/admin/notifications/${id}/read`]);
  return res.data.notification;
};

export const markAllNotificationsRead = async () => {
  if (circuitOpen && Date.now() - circuitOpenedAt < CIRCUIT_TIMEOUT) return false;
  await tryEndpoints('patch', ['/api/admin/notifications/read-all', '/admin/notifications/read-all']);
  return true;
};

export const deleteNotification = async (id) => {
  if (circuitOpen && Date.now() - circuitOpenedAt < CIRCUIT_TIMEOUT) return false;
  await tryEndpoints('delete', [`/api/admin/notifications/${id}`, `/admin/notifications/${id}`]);
  return true;
};

export const clearAllNotifications = async () => {
  if (circuitOpen && Date.now() - circuitOpenedAt < CIRCUIT_TIMEOUT) return false;
  const res = await tryEndpoints('delete', ['/api/admin/notifications', '/admin/notifications']);
  return res?.data || { success: true };
};
