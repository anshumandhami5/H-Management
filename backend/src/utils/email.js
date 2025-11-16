// src/utils/email.js
require('dotenv').config();

const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const FROM = process.env.EMAIL_FROM || 'no-reply@hms.local';

let sgMail = null;
if (process.env.SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  } catch (e) {
    console.error('Warning: @sendgrid/mail not available even though SENDGRID_API_KEY present.', e.message || e);
    sgMail = null;
  }
}

/**
 * Send verification email (public registration)
 */
async function sendVerificationEmail(email, token, name) {
  const verifyUrl = `${FRONTEND}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const subject = 'Verify your HMS account';
  const html = `
    <p>Hi ${name || ''},</p>
    <p>Thanks for registering. Click the link below to verify your email:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>If you did not sign up, ignore this email.</p>
  `;

  if (sgMail) {
    const msg = { to: email, from: FROM, subject, html };
    await sgMail.send(msg);
    console.log('SendGrid: verification email queued to', email);
    return;
  }

  // fallback (dev)
  console.log('=== DEV: verification link (no SENDGRID_API_KEY) ===');
  console.log(verifyUrl);
  console.log('===================================================');
}

/**
 * Send credentials email to newly created staff (admin flow)
 */
async function sendCredentialsEmail(email, tempPassword, name = '', role = '') {
  const subject = `Your HMS account has been created`;
  const html = `
    <p>Hi ${name || ''},</p>
    <p>An account has been created for you on Hospital Management System as <strong>${role}</strong>.</p>
    <p><strong>Login details</strong></p>
    <ul>
      <li>Email: ${email}</li>
      <li>Temporary password: <strong>${tempPassword}</strong></li>
    </ul>
    <p>Please sign in and change your password immediately.</p>
    <p><a href="${FRONTEND}/login">Sign in to HMS</a></p>
    <p>If you did not expect this, contact your administrator.</p>
  `;

  if (sgMail) {
    try {
      await sgMail.send({ to: email, from: FROM, subject, html });
      console.log('Credentials email sent to', email);
      return;
    } catch (err) {
      console.error('SendGrid send failed (credentials):', JSON.stringify(err.response?.body || err, null, 2));
      console.error('Falling back to console log for credentials.');
    }
  }

  // fallback: console (dev)
  console.log('=== DEV: credentials for', email, '===');
  console.log('Temporary password:', tempPassword);
  console.log(`Sign in at: ${FRONTEND}/login`);
  console.log('=======================');
}

// // DUPLICATE CODE BLOCK - COMMENTED OUT
// // backend/src/utils/email.js
// require('dotenv').config();
// const sgMail = require('@sendgrid/mail');
//
// const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
// const FROM = process.env.EMAIL_FROM || 'no-reply@hms.local';
//
// if (process.env.SENDGRID_API_KEY) {
//   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// }
//
// async function sendVerificationEmail(email, token, name) {
//   const verifyUrl = `${FRONTEND}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
//   const msg = {
//     to: email,
//     from: FROM,
//     subject: 'Verify your HMS account',
//     html: `
//       <p>Hi ${name || ''},</p>
//       <p>Thanks for registering. Click the link below to verify your email:</p>
//       <p><a href="${verifyUrl}">${verifyUrl}</a></p>
//       <p>If you did not sign up, ignore this email.</p>
//     `,
//   };
//   if (process.env.SENDGRID_API_KEY) {
//     await sgMail.send(msg);
//     console.log('SendGrid: verification email queued to', email);
//     return;
//   }
//   console.log('=== DEV: verification link ===');
//   console.log(verifyUrl);
// }
//
// async function sendCredentialsEmail(email, tempPassword, name = '', role = '') {
//   const subject = `Your HMS account has been created`;
//   const html = `
//     <p>Hi ${name || ''},</p>
//     <p>An account has been created for you on Hospital Management System as <strong>${role}</strong>.</p>
//     <p><strong>Login details</strong></p>
//     <ul>
//       <li>Email: ${email}</li>
//       <li>Temporary password: <strong>${tempPassword}</strong></li>
//     </ul>
//     <p>Please sign in and change your password immediately.</p>
//     <p><a href="${FRONTEND}/login">Sign in to HMS</a></p>
//   `;
//   if (process.env.SENDGRID_API_KEY) {
//     try {
//       await sgMail.send({ to: email, from: FROM, subject, html });
//       console.log('Credentials email sent to', email);
//       return;
//     } catch (err) {
//       console.error('SendGrid send failed (credentials):', err.response?.body || err);
//     }
//   }
//   console.log('=== DEV: credentials for', email, '===');
//   console.log('Temporary password:', tempPassword);
//   console.log(`Sign in at: ${FRONTEND}/login`);
// }


async function sendAppointmentEmail({ toEmail, patientName, doctorName, startAt, durationMin, reason }) {
  const startStr = new Date(startAt).toLocaleString();
  const subject = `Appointment booked with ${doctorName} — ${startStr}`;
  const html = `
    <p>Hi ${patientName || ''},</p>
    <p>Your appointment with <strong>${doctorName}</strong> is confirmed.</p>
    <ul>
      <li><strong>When:</strong> ${startStr}</li>
      <li><strong>Duration:</strong> ${durationMin} minutes</li>
      <li><strong>Reason:</strong> ${reason || '-'}</li>
    </ul>
    <p>If you need to reschedule or cancel, sign in to your account: <a href="${FRONTEND}/login">${FRONTEND}/login</a></p>
  `;
  if (process.env.SENDGRID_API_KEY) {
    try {
      await sgMail.send({ to: toEmail, from: FROM, subject, html });
      console.log('SendGrid: appointment email queued to', toEmail);
      return;
    } catch (err) {
      console.error('SendGrid send failed (appointment):', err.response?.body || err);
      throw err;
    }
  }
  // fallback
  console.log('=== DEV: appointment email ===');
  console.log('To:', toEmail);
  console.log(html);
}

module.exports = {
  sendVerificationEmail,
  sendCredentialsEmail,
  sendAppointmentEmail
};

