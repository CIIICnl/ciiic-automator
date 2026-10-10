import express from 'express';
import { authorized } from './callbacks.js';
import { consentRouteEnabled } from './activation.js';
import { getConfiguredConsentStore } from './store.js';
import { editionStatus, registerSnapshot } from './newsletter-editions.js';

const EDITION_ID = /^[a-zA-Z0-9:_-]{1,100}$/;

// Consumer: ciiic-nieuwsbrief. Bearer token per consumer, and the whole
// router stays closed (503) until CIIIC_CONSENT_ROUTE is enabled.
export function createEditionRouter({ store, token = process.env.NEWSLETTER_EDITION_TOKEN,
  enabled = () => consentRouteEnabled(), now = () => Date.now() } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!enabled() || !token) return res.sendStatus(503);
    if (!authorized(req.headers.authorization, token)) return res.sendStatus(403);
    if (!EDITION_ID.test(req.params.editionId ?? req.path.split('/')[1] ?? '')) return res.sendStatus(400);
    return next();
  });

  router.post('/:editionId/snapshot', async (req, res) => {
    const registry = store || getConfiguredConsentStore();
    try {
      const result = await registerSnapshot(registry, req.params.editionId, req.body, { now });
      return res.json({ editionId: req.params.editionId, ...result });
    } catch (error) {
      if (error.code === 'FROZEN') {
        return res.status(409).json({ error: 'frozen', summary: await editionStatus(registry, req.params.editionId, { now }) });
      }
      if (error.message === 'Campaign already belongs to another edition') return res.status(409).json({ error: 'campaign_conflict' });
      if (/^(Invalid|Recipient language)/.test(error.message)) return res.status(400).json({ error: error.message });
      return res.sendStatus(503);
    }
  });

  router.get('/:editionId', async (req, res) => {
    const registry = store || getConfiguredConsentStore();
    try {
      const status = await editionStatus(registry, req.params.editionId, { now });
      return status ? res.json(status) : res.sendStatus(404);
    } catch {
      return res.sendStatus(503);
    }
  });
  return router;
}
