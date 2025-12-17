const crypto = require('crypto');
const nodemailer = require('nodemailer');

const otpStore = new Map(); // email -> { code, expiresAt }
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Missing SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

async function sendOtp(email) {
  const code = generateCode();
  const expiresAt = Date.now() + OTP_TTL_MS;
  otpStore.set(email.toLowerCase(), { code, expiresAt });

  const transport = createTransport();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  try {
    await transport.sendMail({
      from,
      to: email,
      subject: 'Your verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`
    });
  } catch (err) {
    console.error('SMTP send error', { message: err.message, code: err.code, response: err.response });
    throw err;
  }

  return { code, expiresAt };
}

function verifyOtp(email, code, { consume = true } = {}) {
  const record = otpStore.get(email.toLowerCase());
  if (!record) return { ok: false, reason: 'not_found' };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return { ok: false, reason: 'expired' };
  }
  if (record.code !== code) return { ok: false, reason: 'mismatch' };
  if (consume) {
    otpStore.delete(email.toLowerCase());
  }
  return { ok: true };
}

module.exports = {
  sendOtp,
  verifyOtp
};
