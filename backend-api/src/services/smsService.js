import { env } from '../config/env.js';

async function sendViaTwilio(to, body) {
  const { accountSid, authToken, from } = env.twilio;
  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER');
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio send failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function sendViaAfricasTalking(to, body) {
  const { username, apiKey, from } = env.africasTalking;
  if (!username || !apiKey) {
    throw new Error("Africa's Talking not configured: set AFRICASTALKING_USERNAME, AFRICASTALKING_API_KEY");
  }
  const url = 'https://api.africastalking.com/version1/messaging';
  const params = new URLSearchParams({ username, to, message: body, ...(from ? { from } : {}) });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Africa's Talking send failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function sendViaTermii(to, body) {
  const { apiKey, from } = env.termii;
  if (!apiKey || !from) {
    throw new Error('Termii not configured: set TERMII_API_KEY, TERMII_FROM');
  }
  const url = 'https://api.ng.termii.com/api/sms/send';
  const payload = {
    to,
    from,
    sms: body,
    type: 'plain',
    channel: 'generic',
    api_key: apiKey,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Termii send failed: ${res.status} ${text}`);
  }
  return res.json();
}

function sendViaConsole(to, body) {
  console.log(`[sms:console] -> ${to}: ${body}`);
  return Promise.resolve({ provider: 'console', to, body });
}

async function logToSheets(to, message, type) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        to,
        message,
        time: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      }),
    });
  } catch { /* non-critical */ }
}

export async function sendSms(to, body, type = 'SMS') {
  let result;
  switch (env.smsProvider) {
    case 'twilio':         result = await sendViaTwilio(to, body); break;
    case 'africastalking': result = await sendViaAfricasTalking(to, body); break;
    case 'termii':         result = await sendViaTermii(to, body); break;
    case 'console':        result = await sendViaConsole(to, body); break;
    default: throw new Error(`Unknown SMS_PROVIDER: ${env.smsProvider}`);
  }
  logToSheets(to, body, type); // fire-and-forget
  return result;
}
