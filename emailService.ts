import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  name?: string;
  resetUrl: string;
}

export interface NewUserAlertOptions {
  adminEmail: string;
  newUser: {
    id: string;
    name: string;
    email: string;
  };
  baseUrl: string;
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_HOST.trim().length > 0);
}

export function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || '',
        }
      : undefined,
    tls: {
      rejectUnauthorized: process.env.SMTP_IGNORE_TLS_ERRORS !== 'true',
    },
  });
}

function getSenderAddress(): string {
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.trim().length > 0) {
    return process.env.SMTP_FROM.trim();
  }
  if (process.env.SMTP_USER && process.env.SMTP_USER.includes('@')) {
    return `"Job Allocator" <${process.env.SMTP_USER}>`;
  }
  return `"Job Allocator" <noreply@allocator.local>`;
}

/**
 * Sends a password reset email to the user.
 * If SMTP is not configured, logs the link clearly to stdout and returns devResetUrl.
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }: EmailOptions): Promise<{ delivered: boolean; devResetUrl?: string; error?: string }> {
  const recipientName = name || 'Instructor';
  const transporter = getTransporter();

  if (!transporter) {
    console.log('\n===============================================================');
    console.log(' [DEV / NO SMTP CONFIGURED] Password Reset Link Generated');
    console.log(` To: ${recipientName} <${to}>`);
    console.log(` Reset URL: ${resetUrl}`);
    console.log(' Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to send real emails.');
    console.log('===============================================================\n');

    return {
      delivered: false,
      devResetUrl: resetUrl,
    };
  }

  const from = getSenderAddress();
  const subject = 'Password Reset Request - Instructor Job Allocator';

  const textBody = `Hello ${recipientName},

You recently requested to reset your password for Instructor Job Allocator.

Please click the link below or copy and paste it into your browser to choose a new password:
${resetUrl}

This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.

Best regards,
Instructor Job Allocator Team`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .badge { display: inline-block; padding: 4px 10px; background-color: #eff6ff; color: #2563eb; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }
    p { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .button-container { margin: 28px 0; text-align: center; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
    .button:hover { background-color: #1d4ed8; }
    .break-word { word-break: break-all; color: #64748b; font-size: 13px; margin-top: 20px; padding: 12px; background: #f1f5f9; border-radius: 6px; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Instructor Job Allocator</span>
    <h1>Password Reset Request</h1>
    <p>Hello <strong>${recipientName}</strong>,</p>
    <p>We received a request to reset your password for your Instructor Job Allocator account. Click the button below to choose a new password:</p>
    
    <div class="button-container">
      <a href="${resetUrl}" class="button" target="_blank" rel="noopener noreferrer">Reset Password</a>
    </div>

    <p>This password reset link will expire in <strong>1 hour</strong>. If you did not make this request, you can safely ignore this email; your account remains secure.</p>
    
    <div class="break-word">
      Button not working? Copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} Instructor Job Allocator. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    });
    console.log(`[SMTP] Password reset email delivered successfully to ${to}`);
    return { delivered: true };
  } catch (error: any) {
    console.error(`[SMTP ERROR] Failed to send password reset email to ${to}:`, error.message);
    // In dev / non-prod or fallback, still surface resetUrl for easy testing
    return {
      delivered: false,
      devResetUrl: resetUrl,
      error: error.message,
    };
  }
}

/**
 * Sends an email notification to the administrator when a new user signs up and needs approval.
 */
export async function sendNewRegistrationAlert({ adminEmail, newUser, baseUrl }: NewUserAlertOptions): Promise<{ delivered: boolean; error?: string }> {
  const targetAdmin = adminEmail || process.env.ADMIN_EMAIL || 'your@admin.com';
  const transporter = getTransporter();

  if (!transporter) {
    console.log('\n===============================================================');
    console.log(' [DEV / NO SMTP CONFIGURED] New User Registration Alert');
    console.log(` Admin Recipient: ${targetAdmin}`);
    console.log(` New User: ${newUser.name} (${newUser.email}) - ID: ${newUser.id}`);
    console.log(` Action: Login at ${baseUrl} to review and approve.`);
    console.log('===============================================================\n');
    return { delivered: false };
  }

  const from = getSenderAddress();
  const subject = `[Action Required] New Registration: ${newUser.name} pending approval`;
  const adminUrl = `${baseUrl.replace(/\/$/, '')}/`;

  const textBody = `Hello Administrator,

A new user has registered for Instructor Job Allocator and is pending approval:

Name: ${newUser.name}
Email: ${newUser.email}
User ID: ${newUser.id}
Date: ${new Date().toUTCString()}

Please log in to the admin panel to review and approve this account:
${adminUrl}

Best regards,
Instructor Job Allocator System`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New User Registration</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .badge { display: inline-block; padding: 4px 10px; background-color: #fef3c7; color: #b45309; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }
    p { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
    .table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
    .table tr:last-child td { border-bottom: none; }
    .table td.label { font-weight: 600; color: #64748b; width: 30%; }
    .table td.value { color: #0f172a; font-weight: 500; }
    .button-container { margin: 28px 0; text-align: center; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; }
    .button:hover { background-color: #1d4ed8; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Admin Approval Required</span>
    <h1>New User Registered</h1>
    <p>A new user has created an account on Instructor Job Allocator and is awaiting your authorization before they can sign in.</p>
    
    <table class="table">
      <tr>
        <td class="label">Name</td>
        <td class="value"><strong>${newUser.name}</strong></td>
      </tr>
      <tr>
        <td class="label">Email</td>
        <td class="value"><a href="mailto:${newUser.email}" style="color:#2563eb; text-decoration:none;">${newUser.email}</a></td>
      </tr>
      <tr>
        <td class="label">Registered At</td>
        <td class="value">${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
      </tr>
    </table>

    <div class="button-container">
      <a href="${adminUrl}" class="button" target="_blank" rel="noopener noreferrer">Open Admin Dashboard</a>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} Instructor Job Allocator. Automated Notification.
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to: targetAdmin,
      subject,
      text: textBody,
      html: htmlBody,
    });
    console.log(`[SMTP] Admin registration alert sent to ${targetAdmin} for user ${newUser.email}`);
    return { delivered: true };
  } catch (error: any) {
    console.error(`[SMTP ERROR] Failed to send admin alert to ${targetAdmin}:`, error.message);
    return { delivered: false, error: error.message };
  }
}
