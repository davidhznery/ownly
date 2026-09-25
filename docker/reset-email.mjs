export function createResetEmailSender({ apiKey, from, origin, fetcher = fetch }) {
  if (!apiKey || !from) return null;
  return async ({ email, token, plan, next }) => {
    const link = `${origin}/reset-password?${new URLSearchParams({ token, ...(plan ? { plan } : {}), ...(next ? { next } : {}) })}`;
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Reset your Ownly password',
        html: `<p>Use this link to reset your Ownly password. It expires in 30 minutes.</p><p><a href="${link}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error('PASSWORD_RESET_EMAIL_FAILED');
  };
}
