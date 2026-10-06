import { createHmac, timingSafeEqual } from 'node:crypto';

// The forms feed signs the literal JSON bytes. This secret is separate from
// registration-status so a marketing feed cannot authorize event changes.
export function verifyCiiicOptinSignature(rawBody, signature, originalUrl, secret = process.env.CIIIC_OPTIN_WEBHOOK_SECRET) {
  if (!secret || !Buffer.isBuffer(rawBody) || !rawBody.length || typeof signature !== 'string' || typeof originalUrl !== 'string' || !originalUrl.startsWith('/')) return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(`POST\n${originalUrl}\n`).update(rawBody).digest();
  return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
}

export function hasFieldValue(body, id) {
  if (!body || !id) return false;
  return Object.keys(body).some(key => (key === id || key.startsWith(`${id}.`)) && String(body[key] ?? '').trim() !== '');
}

export function requireCiiicOptinSignature(req, res, next) {
  if (!process.env.CIIIC_OPTIN_WEBHOOK_SECRET) {
    console.error('CIIIC opt-in webhook secret is not configured');
    return res.status(503).json({ error: 'Webhook verification not configured' });
  }
  if (!verifyCiiicOptinSignature(req.rawBody, req.headers['x-ciiic-optin-signature'], req.originalUrl)) {
    console.error('CIIIC opt-in webhook signature rejected');
    return res.status(403).json({ error: 'Invalid signature' });
  }
  return next();
}

export function subscriptionHttpStatus(result) {
  return ['pending', 'skipped', 'event_only'].includes(result?.status) ? 200 : 503;
}
