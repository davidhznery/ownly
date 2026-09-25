import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { getPlan, hasProductAccess } from './accounts.mjs';
import { authPage, escapeHtml, googleButton, readForm, redirect, safeNext, sendPage } from './auth-ui.mjs';
import { cookieValue, equal } from './sessions.mjs';

const messages = {
  google_cancelled: 'Google sign-in was cancelled. Try again or continue with email.',
  google_failed: 'We could not sign you in with Google. Please try again.',
  google_expired: 'Your Google sign-in expired. Please start again.',
  google_unavailable: 'Google sign-in is temporarily unavailable. You can continue with email.',
  google_conflict: 'This email is already connected to a different Google account. Please use your original sign-in method.',
  owner: 'Use your owner email and password to sign in to this account.',
  link_mismatch: 'Choose the Google account with the same email as your Ownly account.',
};

export function createAuth({ accounts, sessions, origin, adminEmail, adminPassword, googleClientId, googleClientSecret, googleClient, sendResetEmail, now = Date.now }) {
  const google = googleClient || (googleClientId && googleClientSecret ? new OAuth2Client(googleClientId, googleClientSecret, origin + '/auth/google/callback') : null);
  const states = new Map(), attempts = new Map();
  const onboarding = (next, plan) => '/onboarding?' + new URLSearchParams({ next: safeNext(next), plan: getPlan(plan) ? plan : 'individual' });
  const destination = (account, next, plan) => hasProductAccess(account, now()) ? safeNext(next) : onboarding(next, plan || account.plan);
  const csrfField = value => `<input type="hidden" name="csrf" value="${escapeHtml(value)}">`;
  const logoutForm = value => `<form method="post" action="/logout">${csrfField(value)}<button class="quiet" type="submit">Sign out</button></form>`;
  function limited(req) {
    // Do not trust caller-supplied X-Forwarded-For headers.
    const key = req.socket.remoteAddress || 'unknown';
    for (const [ip, bucket] of attempts) if (bucket.until <= now()) attempts.delete(ip);
    const bucket = attempts.get(key) || { count: 0, until: now() + 60000 };
    bucket.count++; attempts.set(key, bucket);
    return bucket.count > 20;
  }
  function render(req, res, { register = false, next = '/dashboard', plan = null, error = '', notice = '', email = '', status = 200 } = {}) {
    const selectedPlan = getPlan(plan) ? plan : null;
    const form = sessions.form(req), query = new URLSearchParams({ next: safeNext(next), ...(selectedPlan ? { plan: selectedPlan } : {}) });
    const googleQuery = new URLSearchParams(query);
    if (register) googleQuery.set('register', '1');
    const body = `${google ? googleButton('/auth/google?' + googleQuery) + '<div class="divider">or</div>' : ''}
      <form method="post" action="${register ? '/register' : '/login'}" data-loading-text="${register ? 'Creating account…' : 'Logging in…'}">${csrfField(form.value)}<input type="hidden" name="next" value="${escapeHtml(safeNext(next))}"><input type="hidden" name="plan" value="${escapeHtml(selectedPlan || '')}">
      <label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required value="${escapeHtml(email)}">
      <label for="password">${register ? 'Create a password' : 'Password'}</label><input id="password" name="password" type="password" ${register ? 'minlength="12" aria-describedby="password-help"' : ''} maxlength="1024" autocomplete="${register ? 'new-password' : 'current-password'}" required>
      ${register ? '<p class="help" id="password-help">Use at least 12 characters.</p><label for="confirm-password">Confirm password</label><input id="confirm-password" name="confirm_password" type="password" minlength="12" maxlength="1024" autocomplete="new-password" required>' : `<p class="help"><a href="/forgot-password?${escapeHtml(query)}">Forgot password?</a></p>`}<button type="submit">${register ? 'Create Account' : 'Log In'}</button></form>
      ${register ? '<p class="note">Creating an account is free. Your 7-day trial starts after you choose a plan and add a payment method. By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>' : '<p class="note">Your account stays available when your trial ends, so you can manage your subscription.</p>'}
      <p class="footer">${register ? `Already have an account? <a href="/login?${escapeHtml(query)}">Log In</a>` : `Don't have an account? <a href="/register?${escapeHtml(query)}">Sign Up</a>`}</p>`;
    sendPage(res, authPage({ title: register ? 'Sign Up' : 'Log In', intro: register ? `Create your account${selectedPlan ? ` for the ${getPlan(selectedPlan).name} plan` : ''}, then activate your 7-day free trial. ${google ? 'Continue with Google or your email.' : 'Continue with your email.'}` : 'Sign in to Ownly to continue to your properties.', body, error, notice }), status, [form.cookie]);
  }
  function oauthError(res, code, flow) {
    const query = new URLSearchParams({ error: code, next: flow?.next || '/dashboard', ...(getPlan(flow?.plan) ? { plan: flow.plan } : {}) });
    redirect(res, (flow?.accountId ? '/account/access?' : flow?.register ? '/register?' : '/login?') + query, [sessions.cookie('ownly_google', '', 0)]);
  }
  function forgotPage(req, res, { error = '', notice = '', status = 200, plan = null, next = '/dashboard' } = {}) {
    const form = sessions.form(req);
    sendPage(res, authPage({ title: 'Reset your password', intro: 'Enter your account email and we will send you a link that expires in 30 minutes.', error, notice,
      body: `<form method="post" action="/forgot-password" data-loading-text="Sending link…">${csrfField(form.value)}<input type="hidden" name="plan" value="${escapeHtml(getPlan(plan) ? plan : '')}"><input type="hidden" name="next" value="${escapeHtml(safeNext(next))}"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required><button type="submit">Send reset link</button></form><p class="footer"><a href="/login?${escapeHtml(new URLSearchParams({ next: safeNext(next), ...(getPlan(plan) ? { plan } : {}) }))}">Back to Log In</a></p>` }), status, [form.cookie]);
  }
  function resetPage(req, res, token, { error = '', status = 200, plan = null, next = '/dashboard' } = {}) {
    const form = sessions.form(req);
    sendPage(res, authPage({ title: 'Choose a new password', intro: 'Use at least 12 characters for your new password.', error,
      body: `<form method="post" action="/reset-password" data-loading-text="Updating password…">${csrfField(form.value)}<input type="hidden" name="token" value="${escapeHtml(token)}"><input type="hidden" name="plan" value="${escapeHtml(getPlan(plan) ? plan : '')}"><input type="hidden" name="next" value="${escapeHtml(safeNext(next))}"><label for="password">New password</label><input id="password" name="password" type="password" minlength="12" maxlength="1024" autocomplete="new-password" required><label for="confirm-password">Confirm password</label><input id="confirm-password" name="confirm_password" type="password" minlength="12" maxlength="1024" autocomplete="new-password" required><button type="submit">Reset password</button></form><p class="footer"><a href="/login">Back to Log In</a></p>` }), status, [form.cookie]);
  }
  const tokenHash = token => createHash('sha256').update(token).digest('hex');
  return {
    googleReady: Boolean(google), render, destination, logoutForm,
    async handle(req, res, url) {
      const session = sessions.get(req.headers.cookie);
      if (req.method === 'GET' && url.pathname === '/auth/session') {
        const form = session ? sessions.form(req) : null;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(form ? { 'Set-Cookie': form.cookie } : {}) });
        res.end(JSON.stringify(session ? { authenticated: true, email: session.email, name: session.name || session.email.split('@')[0], owner: Boolean(session.owner), csrf: form.value, destination: destination(session, '/dashboard') } : { authenticated: false }));
        return true;
      }
      if (req.method === 'GET' && url.pathname === '/forgot-password') { forgotPage(req, res, { plan: url.searchParams.get('plan'), next: url.searchParams.get('next') }); return true; }
      if (req.method === 'POST' && url.pathname === '/forgot-password') {
        let input;
        try { input = await readForm(req); } catch { forgotPage(req, res, { error: 'This form is too large.', status: 413 }); return true; }
        const plan = getPlan(input.get('plan')) ? input.get('plan') : null, next = safeNext(input.get('next'));
        if (!sessions.verifyForm(req, input)) { forgotPage(req, res, { error: 'Your form expired. Please try again.', status: 403, plan, next }); return true; }
        if (limited(req)) { res.setHeader('Retry-After', '60'); forgotPage(req, res, { error: 'Too many attempts. Please wait a minute.', status: 429, plan, next }); return true; }
        if (!sendResetEmail) { forgotPage(req, res, { error: 'Password reset email is temporarily unavailable. Please try again later.', status: 503, plan, next }); return true; }
        const email = String(input.get('email') || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) { forgotPage(req, res, { error: 'Enter a valid email address.', plan, next }); return true; }
        const account = email === adminEmail.toLowerCase() ? null : accounts.byEmail(email);
        if (account && (!account.resetRequestedAt || account.resetRequestedAt + 300000 <= now())) {
          const token = randomBytes(32).toString('base64url'), hash = tokenHash(token);
          accounts.requestPasswordReset(account.id, hash, now() + 1800000, now());
          try { await sendResetEmail({ email, token, plan, next }); }
          catch (error) { accounts.clearPasswordReset(account.id, hash); console.error('Password reset email could not be sent:', error.message); }
        }
        forgotPage(req, res, { notice: 'If an account exists for that email, a reset link will arrive shortly.', plan, next });
        return true;
      }
      if (req.method === 'GET' && url.pathname === '/reset-password') {
        const token = url.searchParams.get('token') || '';
        if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !accounts.byResetToken(tokenHash(token), now())) {
          sendPage(res, authPage({ title: 'Reset link expired', intro: 'This link is invalid or has expired. Request a new one to continue.', body: '<a class="button" href="/forgot-password">Request a new link</a>' }), 400);
        } else resetPage(req, res, token, { plan: url.searchParams.get('plan'), next: url.searchParams.get('next') });
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/reset-password') {
        let input;
        try { input = await readForm(req); } catch { sendPage(res, authPage({ title: 'Please try again', intro: 'The form is too large.', body: '<a href="/forgot-password">Request a new link</a>' }), 413); return true; }
        const token = String(input.get('token') || ''), password = String(input.get('password') || ''), confirm = String(input.get('confirm_password') || ''), plan = getPlan(input.get('plan')) ? input.get('plan') : null, next = safeNext(input.get('next'));
        if (!sessions.verifyForm(req, input)) { resetPage(req, res, token, { error: 'Your form expired. Please reload the reset link.', status: 403, plan, next }); return true; }
        if (limited(req)) { res.setHeader('Retry-After', '60'); resetPage(req, res, token, { error: 'Too many attempts. Please wait a minute.', status: 429, plan, next }); return true; }
        if (password.length < 12 || password.length > 1024 || password !== confirm) { resetPage(req, res, token, { error: 'Use at least 12 characters and make sure both passwords match.', plan, next }); return true; }
        if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !accounts.byResetToken(tokenHash(token), now())) { redirect(res, '/forgot-password'); return true; }
        if (!accounts.consumePasswordReset(tokenHash(token), accounts.hash(password), now())) { redirect(res, '/forgot-password'); return true; }
        redirect(res, '/login?' + new URLSearchParams({ reset: '1', next, ...(plan ? { plan } : {}) }), [sessions.clear()]);
        return true;
      }
      if (req.method === 'GET' && ['/login', '/register'].includes(url.pathname)) {
        if (session) redirect(res, destination(session, url.searchParams.get('next'), url.searchParams.get('plan')));
        else render(req, res, { register: url.pathname === '/register', next: url.searchParams.get('next'), plan: url.searchParams.get('plan'), error: messages[url.searchParams.get('error')] || '', notice: url.searchParams.get('reset') === '1' ? 'Your password has been updated. Log in with your new password.' : '' });
        return true;
      }
      if (req.method === 'POST' && ['/login', '/register'].includes(url.pathname)) {
        const register = url.pathname === '/register';
        let input;
        try { input = await readForm(req); } catch { render(req, res, { register, error: 'This form is too large. Please try again.', status: 413 }); return true; }
        const email = String(input.get('email') || '').trim().toLowerCase(), password = String(input.get('password') || ''), confirm = String(input.get('confirm_password') || ''), next = safeNext(input.get('next')), plan = getPlan(input.get('plan')) ? input.get('plan') : null;
        const fail = (error, status = 400) => render(req, res, { register, email, next, plan, error, status });
        if (!sessions.verifyForm(req, input)) { fail('Your form expired. Please try again.', 403); return true; }
        if (limited(req)) { res.setHeader('Retry-After', '60'); fail('Too many attempts. Please wait a minute and try again.', 429); return true; }
        if (session) { redirect(res, destination(session, next, plan)); return true; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 1024 || (register && password.length < 12)) { fail(register ? 'Enter a valid email and a password with at least 12 characters.' : 'Enter your email and password.'); return true; }
        if (register) {
          if (password !== confirm) { fail('Passwords do not match. Please try again.'); return true; }
          if (email === adminEmail.toLowerCase() || accounts.byEmail(email)) { fail('An account with this email already exists. Please sign in.', 409); return true; }
          const account = accounts.create(email, accounts.hash(password), plan || 'individual');
          redirect(res, onboarding(next, plan), [sessions.issue(account.id)]);
        } else {
          // Owner credentials cannot accidentally select a customer account with the same email.
          if (equal(email, adminEmail.toLowerCase()) && equal(password, adminPassword)) redirect(res, next, [sessions.issue('owner')]);
          else {
            const account = accounts.byEmail(email);
            if (!account || !accounts.verify(account, password)) { fail('Email or password incorrect. If you joined with Google, use Continue with Google.', 401); return true; }
            redirect(res, destination(account, next, plan || account.plan), [sessions.issue(account.id)]);
          }
        }
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/logout') {
        const input = await readForm(req);
        if (!sessions.verifyForm(req, input)) sendPage(res, authPage({ title: 'Please try again', intro: 'Reload the page before signing out.', body: '<a href="/account/access">Back to your account</a>' }), 403);
        else redirect(res, '/', [sessions.clear()]);
        return true;
      }
      if (req.method === 'GET' && url.pathname === '/signout-with-chatgpt') {
        redirect(res, '/login', [sessions.clear()]); return true;
      }
      if (req.method === 'GET' && url.pathname === '/account/access') {
        if (!session) { redirect(res, '/login'); return true; }
        const form = sessions.form(req);
        sendPage(res, authPage({ title: 'Sign-in settings', intro: 'Keep using the same Ownly account with your preferred sign-in method.', step: 3,
          error: messages[url.searchParams.get('error')] || '', notice: url.searchParams.get('linked') === '1' ? 'Google is connected to your account.' : '',
          body: `<p class="identity">${escapeHtml(session.email)}</p><p>${session.googleId ? 'Google is connected.' : session.owner ? 'You sign in with your owner credentials.' : 'You sign in with your email and password.'}</p>${!session.owner && !session.googleId && google ? googleButton('/auth/google?link=1', 'Connect Google') : ''}<p><a href="${hasProductAccess(session, now()) ? '/dashboard' : '/onboarding'}">Continue to your account →</a></p>${logoutForm(form.value)}` }), 200, [form.cookie]);
        return true;
      }
      if (req.method === 'GET' && url.pathname === '/auth/google') {
        if (!google) { oauthError(res, 'google_unavailable'); return true; }
        const linking = url.searchParams.get('link') === '1';
        if (linking && (!session || session.owner)) { redirect(res, '/login'); return true; }
        if (session && !linking) { redirect(res, destination(session, url.searchParams.get('next'), url.searchParams.get('plan'))); return true; }
        if (limited(req)) { res.setHeader('Retry-After', '60'); render(req, res, { error: 'Too many attempts. Please wait a minute.', status: 429 }); return true; }
        for (const [key, flow] of states) if (flow.expires <= now()) states.delete(key);
        if (states.size >= 1000) { oauthError(res, 'google_unavailable'); return true; }
        const state = randomBytes(32).toString('hex'), nonce = randomBytes(32).toString('hex'), verifier = randomBytes(32).toString('base64url');
        states.set(state, { nonce, verifier, expires: now() + 600000, next: safeNext(url.searchParams.get('next')), plan: getPlan(url.searchParams.get('plan')) ? url.searchParams.get('plan') : null, register: url.searchParams.get('register') === '1', accountId: linking ? session.id : null });
        const location = google.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, nonce, prompt: 'select_account', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
        redirect(res, location, [sessions.cookie('ownly_google', state, 600)]); return true;
      }
      if (req.method === 'GET' && url.pathname === '/auth/google/callback') {
        const state = url.searchParams.get('state'), flow = states.get(state);
        if (!flow || !equal(state, cookieValue(req.headers.cookie, 'ownly_google')) || flow.expires <= now()) { oauthError(res, 'google_expired'); return true; }
        states.delete(state); // A state can only be consumed once, including failed/cancelled attempts.
        if (url.searchParams.has('error')) { oauthError(res, 'google_cancelled', flow); return true; }
        if (!google || !url.searchParams.get('code')) { oauthError(res, 'google_failed', flow); return true; }
        if (flow.accountId && session?.id !== flow.accountId) { oauthError(res, 'google_expired'); return true; }
        try {
          const { tokens } = await google.getToken({ code: url.searchParams.get('code'), codeVerifier: flow.verifier, redirect_uri: origin + '/auth/google/callback' });
          const ticket = await google.verifyIdToken({ idToken: tokens.id_token, audience: googleClientId });
          const identity = ticket.getPayload();
          if (!identity?.sub || identity.email_verified !== true || !identity.email || !equal(identity.nonce, flow.nonce)) throw Error('INVALID_GOOGLE_IDENTITY');
          const email = identity.email.trim().toLowerCase();
          if (email === adminEmail.toLowerCase()) { oauthError(res, 'owner', flow); return true; }
          let account = accounts.byGoogleId(identity.sub);
          if (flow.accountId) {
            if (email !== session.email || (account && account.id !== session.id)) { oauthError(res, 'link_mismatch', flow); return true; }
            account = accounts.linkGoogle(session.id, identity.sub);
          } else if (!account) {
            const matchingEmail = accounts.byEmail(email);
            if (matchingEmail) {
              if (matchingEmail.googleId && matchingEmail.googleId !== identity.sub) { oauthError(res, 'google_conflict', flow); return true; }
              account = accounts.linkGoogle(matchingEmail.id, identity.sub);
            } else account = accounts.create(email, null, flow.plan || 'individual', { googleId: identity.sub, name: String(identity.name || '').slice(0,100) });
          }
          redirect(res, flow.accountId ? '/account/access?linked=1' : destination(account, flow.next, flow.plan), [sessions.issue(account.id), sessions.cookie('ownly_google', '', 0)]);
        } catch { oauthError(res, 'google_failed', flow); }
        return true;
      }
      return false;
    },
  };
}
