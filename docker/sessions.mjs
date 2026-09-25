import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function equal(a, b) {
  const left = Buffer.from(a || ''), right = Buffer.from(b || '');
  return left.length === right.length && timingSafeEqual(left, right);
}
export function cookieValue(header, name) {
  return (header || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))?.slice(name.length + 1) || '';
}
export function createSessions({ password, token, email, origin, accounts, now = Date.now }) {
  // Keep the existing key derivation and session format to preserve customer sessions.
  const key = createHash('sha256').update(password + '\0' + token).digest();
  const lifetime = 7 * 86400000;
  const formLifetime = lifetime;
  const sign = value => createHmac('sha256', key).update(value).digest('hex');
  const cookie = (name, value, maxAge) => `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; ${origin.startsWith('https://') ? 'Secure; ' : ''}Max-Age=${maxAge}`;
  function issue(subject) { const payload = `${now() + lifetime}.${subject}`; return cookie('ownly_session', `${payload}.${sign(payload)}`, lifetime / 1000); }
  function get(header) {
    const match = /^(\d{13})\.([a-zA-Z0-9-]+)\.([a-f0-9]{64})$/.exec(cookieValue(header, 'ownly_session'));
    if (!match || Number(match[1]) <= now() || Number(match[1]) > now() + lifetime || !equal(match[3], sign(`${match[1]}.${match[2]}`))) return null;
    if (match[2] === 'owner') return { userId: 'docker-owner', email, name: 'Ownly Owner', owner: true };
    const account = accounts.byId(match[2]);
    return account && (!account.passwordChangedAt || Number(match[1]) - lifetime >= account.passwordChangedAt) ? account : null;
  }
  function validForm(value, session = '') {
    const match = /^(\d{13})\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(value || '');
    return Boolean(match && Number(match[1]) > now() && equal(match[3], sign(`${session ? `session-form:${session}:` : 'form:'}${match[1]}.${match[2]}`)));
  }
  function form(req) {
    const session = get(req.headers.cookie) ? cookieValue(req.headers.cookie, 'ownly_session') : '';
    if (session) {
      const payload = `${now() + formLifetime}.${randomBytes(32).toString('hex')}`;
      return { value: `${payload}.${sign(`session-form:${session}:${payload}`)}`, cookie: cookie('ownly_form', '', 0) };
    }
    let value = cookieValue(req.headers.cookie, 'ownly_form');
    if (!validForm(value)) { const payload = `${now() + formLifetime}.${randomBytes(32).toString('hex')}`; value = `${payload}.${sign('form:' + payload)}`; }
    return { value, cookie: cookie('ownly_form', value, formLifetime / 1000) };
  }
  function verifyForm(req, input) {
    const value = input.get('csrf');
    const sameOrigin = !req.headers.origin || req.headers.origin === origin || req.headers['sec-fetch-site'] === 'same-origin';
    if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') return false;
    const session = get(req.headers.cookie) ? cookieValue(req.headers.cookie, 'ownly_session') : '';
    if (session) return validForm(value, session);
    return validForm(value) && equal(value, cookieValue(req.headers.cookie, 'ownly_form'));
  }
  return { get, issue, form, verifyForm, cookie, clear: () => cookie('ownly_session', '', 0) };
}
