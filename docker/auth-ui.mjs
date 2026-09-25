import { randomBytes } from 'node:crypto';

export const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function authPage({ title, intro, body, step = 1, notice = '', error = '' }) {
  const nonce = randomBytes(16).toString('base64');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Ownly Malta</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f3f6f2;color:#18392d;font:16px/1.5 system-ui,sans-serif}a{color:#166b49}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #66a986;outline-offset:4px}.layout{min-height:100vh;display:grid;grid-template-columns:minmax(300px,1fr) minmax(400px,1fr)}.story{padding:clamp(28px,6vw,90px);background:#173f32;color:#f0f5ed;display:flex;flex-direction:column;justify-content:space-between;gap:48px}.brand{font-size:30px;font-weight:800;letter-spacing:-1.5px;text-decoration:none;color:inherit}.story h2{font-family:Georgia,serif;font-size:clamp(34px,4vw,58px);font-weight:400;line-height:1.1;max-width:530px}.story p{color:#c6d8cb;max-width:400px}.steps{list-style:none;padding:0;display:flex;gap:18px;flex-wrap:wrap;font-size:13px}.steps li{color:#bccfc3}.steps [aria-current]{color:white;font-weight:700}.panel{padding:clamp(24px,5vw,72px);display:grid;place-items:center}.card{width:100%;max-width:460px}h1{font-size:30px;line-height:1.2;letter-spacing:-.8px;margin:16px 0}p{color:#53675b}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#52745f}label{display:block;font-size:14px;font-weight:600;margin:20px 0 6px}input{width:100%;padding:13px 14px;background:white;border:1px solid #b9cbbd;border-radius:10px;font:inherit;color:inherit}.button,button{display:block;text-align:center;width:100%;padding:13px 16px;border:1px solid #166b49;border-radius:10px;background:#166b49;color:white;font:600 15px/1.5 system-ui;text-decoration:none;cursor:pointer;margin:22px 0 0}.google{background:white;color:#24352b;border-color:#c4cfc6;display:flex;gap:12px;align-items:center;justify-content:center}.google svg{width:20px;height:20px;flex:none}.divider{display:flex;gap:14px;align-items:center;margin:24px 0;color:#708076;font-size:13px}.divider:before,.divider:after{content:'';height:1px;background:#d7e1d8;flex:1}.note,.help{font-size:13px}.help{margin:6px 0}.footer{text-align:center;margin-top:26px}.notice,.error{padding:14px;border-radius:10px;background:#e6f0e5;margin:18px 0}.error{color:#802323;background:#fbeaea}.plan{display:flex;align-items:center;gap:12px;border:1px solid #c5d4c8;border-radius:12px;padding:16px;background:white;font-weight:400}.plan:has(input:checked){border-color:#166b49;box-shadow:0 0 0 1px #166b49}.plan input{width:18px;height:18px;accent-color:#166b49}.plan span{flex:1}.plan small{display:block;color:#607165}.identity{padding:14px 16px;background:#e6eee6;border-radius:10px;overflow-wrap:anywhere}.quiet{background:transparent;color:#45604e;border:0;padding:5px;margin-top:14px;font-weight:400}.actions{display:flex;gap:16px;flex-wrap:wrap}.actions a{font-size:14px}.back{display:inline-block;margin-bottom:22px;font-size:14px}@media(max-width:800px){.layout{display:block}.story{padding:24px;gap:12px}.story h2,.story p{display:none}.steps{margin:0;gap:12px;font-size:11px}.panel{padding:32px 24px}.story .brand{font-size:26px}}@media(prefers-reduced-motion:no-preference){button,.button{transition:filter .15s}button:hover,.button:hover{filter:brightness(.94)}}
  </style></head><body><main class="layout"><aside class="story"><a class="brand" href="/">Ownly<span aria-hidden="true">.</span></a><div><h2>A clearer picture of your property.</h2><p>Your income, expenses and portfolio, together in one private workspace.</p></div><ol class="steps" aria-label="Getting started"><li ${step === 1 ? 'aria-current="step"' : ''}>1 · Your account</li><li ${step === 2 ? 'aria-current="step"' : ''}>2 · Your free trial</li><li ${step === 3 ? 'aria-current="step"' : ''}>3 · Your dashboard</li></ol></aside><section class="panel"><div class="card"><a class="back" href="/">← Back to Ownly</a><div class="eyebrow">Your property. Your account.</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}${notice ? `<p class="notice" role="status">${escapeHtml(notice)}</p>` : ''}${body}</div></section></main><script nonce="${nonce}">document.querySelectorAll('form[data-loading-text]').forEach(form=>form.addEventListener('submit',event=>{const password=form.querySelector('input[name="password"]'),confirmation=form.querySelector('input[name="confirm_password"]');if(confirmation){confirmation.setCustomValidity(confirmation.value===password.value?'':'Passwords do not match.');if(!confirmation.reportValidity()){event.preventDefault();return;}}const button=form.querySelector('button[type="submit"]');if(button){button.disabled=true;button.textContent=form.dataset.loadingText;}}));document.querySelectorAll('input[name="confirm_password"]').forEach(input=>input.addEventListener('input',()=>input.setCustomValidity('')));</script></body></html>`;
}

export function googleButton(href, label = 'Continue with Google') {
  return `<a class="button google" href="${escapeHtml(href)}"><svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59a14.41 14.41 0 0 1 0-9.18l-7.98-6.19a23.93 23.93 0 0 0 0 21.56l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>${escapeHtml(label)}</a>`;
}

export function sendPage(res, html, status = 200, cookies = []) {
  const nonce = /<script nonce="([A-Za-z0-9+/=]+)">/.exec(html)?.[1];
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src ${nonce ? `'nonce-${nonce}'` : "'none'"}; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    ...(cookies.length ? { 'Set-Cookie': cookies } : {}),
  });
  res.end(html);
}

export function redirect(res, location, cookies = []) {
  res.writeHead(303, { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
  res.end();
}

export async function readForm(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > 8192) throw Error('FORM_TOO_LARGE'); chunks.push(Buffer.from(chunk)); }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

export function safeNext(value) {
  try {
    if (!value?.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/dashboard';
    const url = new URL(value, 'https://ownly.local');
    if (url.origin !== 'https://ownly.local' || !/^\/(dashboard|admin)(\/|$)/.test(url.pathname)) return '/dashboard';
    return url.pathname + url.search + url.hash;
  } catch { return '/dashboard'; }
}
