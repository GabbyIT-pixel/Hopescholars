'use strict';
// Notification Service (SRS 3.3, 3.4): sends email for password recovery and deadline reminders when SMTP is configured.
// Without SMTP settings nothing is sent and the app keeps working with in-app alerts only.
const nodemailer = require('nodemailer');
const config = require('./config');

let transport = null;
const enabled = () => !!(config.smtpHost && config.smtpUser && config.smtpPass);

function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465, auth: { user: config.smtpUser, pass: config.smtpPass } });
  return transport;
}

/** Fire-and-forget safe: never throws, resolves true when the message was handed to the mail server. */
async function send({ to, subject, text }) {
  if (!enabled() || !to) return false;
  try {
    await getTransport().sendMail({ from: config.mailFrom || config.smtpUser, to, subject, text });
    return true;
  } catch (e) { console.error('[mail] could not send:', e.message); return false; }
}

module.exports = { enabled, send, _setTransport: (t) => { transport = t; } };
