// The consent route is opt-in per deployment. Without this exact value every
// signup route keeps the pre-consent Mailchimp behaviour, so merging the
// preparation cannot switch live Gravity Forms feeds (Form43/feed7 posts to
// list=ciiic unsigned) to a route that needs signing and registry keys.
// Enabling it is TODO5 activation work, not part of a deploy.
export function consentRouteEnabled(env = process.env) {
  return env.CIIIC_CONSENT_ROUTE === 'enabled';
}
