const nodemailer = require('nodemailer');
const config = require('../config/env');
const { AppError } = require('../middleware/errorHandler');

function getTransporter() {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword || !config.emailFrom) {
    throw new AppError('Email delivery is not configured. Set the SMTP environment variables.', 503, 'EMAIL_NOT_CONFIGURED');
  }

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPassword },
  });
}

function isConfigured() {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPassword && config.emailFrom);
}

async function sendVerificationCode({ email, fullName, code, expiresInMinutes }) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: config.emailFrom,
    to: email,
    subject: 'Verify your SmartTracker email address',
    text: `Hello ${fullName},\n\nYour SmartTracker verification code is ${code}. It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Hello ${escapeHtml(fullName)},</p><p>Your SmartTracker verification code is <strong>${code}</strong>.</p><p>It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
  });
}

async function sendLoginAlert({ email, fullName, organisationName, ipAddress, userAgent, signedInAt }) {
  const transporter = getTransporter();
  const date = signedInAt.toISOString();
  const safeName = escapeHtml(fullName);
  const safeOrganisation = escapeHtml(organisationName);
  const safeIpAddress = escapeHtml(ipAddress || 'Unavailable');
  const safeUserAgent = escapeHtml(userAgent || 'Unavailable');
  await transporter.sendMail({
    from: config.emailFrom,
    to: email,
    subject: 'New sign-in to your SmartTracker account',
    text: `Hello ${fullName},\n\nA successful sign-in to your SmartTracker account (${organisationName}) was detected.\n\nTime (UTC): ${date}\nIP address: ${ipAddress || 'Unavailable'}\nDevice: ${userAgent || 'Unavailable'}\n\nIf you do not recognize this activity, change your password and contact your organisation administrator.`,
    html: `<p>Hello ${safeName},</p><p>A successful sign-in to your SmartTracker account (${safeOrganisation}) was detected.</p><ul><li>Time (UTC): ${escapeHtml(date)}</li><li>IP address: ${safeIpAddress}</li><li>Device: ${safeUserAgent}</li></ul><p>If you do not recognize this activity, change your password and contact your organisation administrator.</p>`,
  });
}

async function sendPasswordResetCode({ email, fullName, code, expiresInMinutes }) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: config.emailFrom,
    to: email,
    subject: 'Reset your SmartTracker password',
    text: `Hello ${fullName},\n\nYour SmartTracker password reset code is ${code}. It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Hello ${escapeHtml(fullName)},</p><p>Your SmartTracker password reset code is <strong>${code}</strong>.</p><p>It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
  });
}

async function sendAdminInvitation({ email, fullName, code, expiresInMinutes }) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: config.emailFrom,
    to: email,
    subject: 'You have been invited to SmartTracker',
    text: `Hello ${fullName},\n\nAn organisation administrator invited you to create an Internal Admin account. Your one-time setup code is ${code}. It expires in ${expiresInMinutes} minutes. If you did not expect this invitation, ignore this email.`,
    html: `<p>Hello ${escapeHtml(fullName)},</p><p>An organisation administrator invited you to create an Internal Admin account.</p><p>Your one-time setup code is <strong>${code}</strong>. It expires in ${expiresInMinutes} minutes.</p><p>If you did not expect this invitation, ignore this email.</p>`,
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

module.exports = {
  isConfigured,
  sendVerificationCode,
  sendLoginAlert,
  sendPasswordResetCode,
  sendAdminInvitation,
};
