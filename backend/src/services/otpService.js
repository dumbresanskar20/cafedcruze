const nodemailer = require('nodemailer');

// Generate 6-digit numerical OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Reusable MealBook Email Layout with Header and Footer branding & website
const getMealBookEmailLayout = ({ title, bodyHtml }) => {
  const websiteUrl = 'https://mealbook.in';
  const studentPortalUrl = process.env.FRONTEND_STUDENT_URL || 'https://dupcoei-canteen.mealbook.in';
  const currentYear = new Date().getFullYear();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 30px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
              
              <!-- 1. MEALBOOK HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 28px 24px; text-align: center;">
                  <div style="display: inline-block; background: #ffffff; padding: 8px 18px; border-radius: 9999px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 10px;">
                    <span style="font-size: 20px; font-weight: 900; color: #ea580c; letter-spacing: -0.5px; vertical-align: middle;">
                      🍱 MealBook
                    </span>
                  </div>
                  <h1 style="margin: 4px 0 0 0; color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: -0.2px;">
                    Smart Campus Mess & Canteen
                  </h1>
                  <div style="margin-top: 10px;">
                    <a href="${websiteUrl}" target="_blank" style="color: #ffedd5; font-size: 12px; font-weight: 700; text-decoration: underline; letter-spacing: 0.3px;">
                      🌐 Visit Website: mealbook.in
                    </a>
                  </div>
                </td>
              </tr>

              <!-- 2. MAIN CONTENT BODY -->
              <tr>
                <td style="padding: 32px 28px; background-color: #ffffff;">
                  ${bodyHtml}
                </td>
              </tr>

              <!-- 3. MEALBOOK FOOTER -->
              <tr>
                <td style="background-color: #f8fafc; padding: 24px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <div style="margin-bottom: 10px;">
                    <span style="font-size: 15px; font-weight: 800; color: #0f172a;">🍱 MealBook</span>
                    <span style="font-size: 13px; color: #64748b; font-weight: 500;"> — Smart Campus Dining Platform</span>
                  </div>

                  <p style="margin: 0 0 12px 0; font-size: 13px; color: #475569; line-height: 1.5;">
                    Official Website: 
                    <a href="${websiteUrl}" target="_blank" style="color: #ea580c; font-weight: 700; text-decoration: none;">
                      www.mealbook.in
                    </a>
                    &nbsp;•&nbsp;
                    <a href="${studentPortalUrl}" target="_blank" style="color: #ea580c; font-weight: 600; text-decoration: none;">
                      Student Canteen Portal
                    </a>
                  </p>

                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">
                    This is an automated verification email. Please do not reply directly to this message.
                  </p>
                  
                  <p style="margin: 0; font-size: 11px; color: #cbd5e1; font-weight: 500;">
                    © ${currentYear} MealBook. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Create transport dynamically or log in dev
const sendEmail = async ({ to, subject, html, text }) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

  if (SMTP_USER && SMTP_PASS) {
    try {
      const isGmail = !SMTP_HOST || SMTP_HOST.includes('gmail');
      const transportConfig = isGmail
        ? {
            service: 'gmail',
            auth: { user: SMTP_USER, pass: SMTP_PASS },
          }
        : {
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 465,
            secure: Number(SMTP_PORT) === 465 || Number(SMTP_PORT) === 0 || !SMTP_PORT,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          };

      const transporter = nodemailer.createTransport(transportConfig);

      const senderEmail = EMAIL_FROM || `"Cafe D Cruze Restaurant" <${SMTP_USER}>`;

      const info = await transporter.sendMail({
        from: senderEmail,
        to,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ''),
        html,
      });

      console.log(`[Email Service] Email sent successfully to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.warn(`[Email Service] Failed to send email via SMTP (${err.message}). Logging message instead.`);
    }
  }

  // Fallback for local development or missing SMTP credentials
  console.log('\n========================================');
  console.log(`[DEV EMAIL MOCK] To: ${to}`);
  console.log(`[DEV EMAIL MOCK] Subject: ${subject}`);
  console.log(`[DEV EMAIL MOCK] Content:\n${text || html}`);
  console.log('========================================\n');
  return { success: true, mock: true };
};

const sendViaBrevo = async (to, subject, html, text) => {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.warn('[Brevo Service] BREVO_API_KEY is not defined in environment variables! Logging OTP email instead.');
    return null;
  }

  if (BREVO_API_KEY.startsWith('xsmtpsib-')) {
    console.warn('[Brevo Service] WARNING: The BREVO_API_KEY starts with "xsmtpsib-", which indicates it is an SMTP Key (password) instead of a REST API Key. The REST API requires a REST API Key (prefixed with "xkeysib-"). Please generate one in Brevo -> SMTP & API -> API Keys.');
  }

  try {
    let senderEmail = 'dumbresanskar06@gmail.com';
    const envFrom = process.env.EMAIL_FROM;
    if (envFrom) {
      const match = envFrom.match(/<([^>]+)>/);
      if (match && match[1]) {
        senderEmail = match[1].trim();
      } else {
        senderEmail = envFrom.trim();
      }
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'MealBook', email: senderEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text || html.replace(/<[^>]*>?/gm, ''),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to send transactional email');
    }

    console.log('[Brevo Service] Email sent successfully via Brevo API:', data);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('[Brevo Service] Error sending email via Brevo:', error.message);
    throw error;
  }
};

const sendOTP = async (email, otpCode) => {
  const subject = 'MealBook - Your Verification Code';
  const bodyHtml = `
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 800;">
      Account Verification Code
    </h2>
    <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      Hello,
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      Thank you for choosing <strong>MealBook</strong>. Please use the One-Time Password (OTP) verification code below to verify your student account:
    </p>

    <!-- OTP Code Display Card -->
    <div style="background: #fff7ed; border: 2px dashed #fb923c; border-radius: 14px; padding: 22px 16px; text-align: center; margin: 24px 0;">
      <span style="font-family: 'SF Pro Mono', Menlo, Consolas, Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #ea580c; display: block; margin-left: 10px;">
        ${otpCode}
      </span>
      <span style="display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 700; color: #c2410c; background: #ffedd5; padding: 4px 12px; border-radius: 9999px;">
        ⏱️ Valid for 10 minutes only
      </span>
    </div>

    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
      🔒 <strong>Security Tip:</strong> Never share this code with anyone. MealBook representatives will never ask for your OTP.
    </p>
    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.4;">
      If you did not request this verification code, please ignore this email.
    </p>
  `;

  const html = getMealBookEmailLayout({
    title: 'MealBook Verification Code',
    bodyHtml,
  });

  const text = `Your MealBook OTP verification code is ${otpCode}. It expires in 10 minutes.\n\nOfficial Website: https://mealbook.in\nPowered by MealBook.`;

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (BREVO_API_KEY) {
    try {
      const res = await sendViaBrevo(email, subject, html, text);
      if (res && res.success) return res;
    } catch (err) {
      console.warn('[Brevo OTP] Failed to send via Brevo REST API, trying standard SMTP fallback...');
    }
  }

  return await sendEmail({ to: email, subject, html, text });
};

const sendAdminInvitation = async (email, username, inviteLink) => {
  const subject = 'Staff Account Invitation - MealBook';
  const bodyHtml = `
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 800;">
      👨‍🍳 Welcome to MealBook Kitchen Operations
    </h2>
    <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      Hello <strong>${username}</strong>,
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      An administrator has invited you to join the canteen operations team on <strong>MealBook</strong>.
    </p>
    <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      Please click the button below to set up your secure password and activate your staff account:
    </p>

    <div style="text-align: center; margin: 25px 0;">
      <a href="${inviteLink}" style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 800; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(234, 88, 12, 0.3);">
        Set Up Your Password
      </a>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 20px 0 0 0;">
      Or copy and paste this link into your browser:<br/>
      <a href="${inviteLink}" style="color: #ea580c; word-break: break-all;">${inviteLink}</a>
    </p>
  `;

  const html = getMealBookEmailLayout({
    title: 'MealBook Staff Invitation',
    bodyHtml,
  });

  const text = `Hello ${username},\n\nYou have been invited to MealBook. Set up your password here: ${inviteLink}\n\nOfficial Website: https://mealbook.in`;

  return await sendEmail({ to: email, subject, html, text });
};

const sendStudentPasswordReset = async (email, resetLink) => {
  const subject = 'Reset Your MealBook Account Password';
  const bodyHtml = `
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 800;">
      🍱 Password Reset Request
    </h2>
    <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      Hello,
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      We received a request to reset the password for your <strong>MealBook</strong> student account.
    </p>
    <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      Click the button below to choose a new password. This secure link is valid for <strong>15 minutes</strong>:
    </p>

    <div style="text-align: center; margin: 25px 0;">
      <a href="${resetLink}" style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 800; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(234, 88, 12, 0.3);">
        Reset Password
      </a>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 20px 0 0 0;">
      Or copy and paste this link into your browser:<br/>
      <a href="${resetLink}" style="color: #ea580c; word-break: break-all;">${resetLink}</a>
    </p>
    <p style="font-size: 12px; color: #94a3b8; margin: 16px 0 0 0;">
      If you did not request a password reset, you can safely disregard this email.
    </p>
  `;

  const html = getMealBookEmailLayout({
    title: 'MealBook Password Reset',
    bodyHtml,
  });

  const text = `Reset your MealBook password: ${resetLink}\nValid for 15 minutes.\n\nOfficial Website: https://mealbook.in`;

  return await sendEmail({ to: email, subject, html, text });
};

const sendForgotPasswordOTP = async (email, otpCode) => {
  const subject = 'MealBook - Password Reset Code';
  const bodyHtml = `
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 800;">
      Password Reset OTP
    </h2>
    <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      Hello,
    </p>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
      We received a request to reset the password for your <strong>MealBook</strong> student account. Use the verification OTP code below to complete your password reset:
    </p>

    <!-- OTP Code Display Card -->
    <div style="background: #fff7ed; border: 2px dashed #fb923c; border-radius: 14px; padding: 22px 16px; text-align: center; margin: 24px 0;">
      <span style="font-family: 'SF Pro Mono', Menlo, Consolas, Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #ea580c; display: block; margin-left: 10px;">
        ${otpCode}
      </span>
      <span style="display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 700; color: #c2410c; background: #ffedd5; padding: 4px 12px; border-radius: 9999px;">
        ⏱️ Valid for 10 minutes only
      </span>
    </div>

    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
      🔒 <strong>Security Tip:</strong> Never share this code with anyone. MealBook representatives will never ask for your OTP.
    </p>
    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.4;">
      If you did not request this password reset, you can safely ignore this email.
    </p>
  `;

  const html = getMealBookEmailLayout({
    title: 'MealBook Password Reset Code',
    bodyHtml,
  });

  const text = `Your MealBook password reset code is ${otpCode}. It expires in 10 minutes.\n\nOfficial Website: https://mealbook.in\nPowered by MealBook.`;

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (BREVO_API_KEY) {
    try {
      const res = await sendViaBrevo(email, subject, html, text);
      if (res && res.success) return res;
    } catch (err) {
      console.warn('[Brevo Forgot Password OTP] Failed to send via Brevo REST API, trying standard SMTP fallback...', err.message);
    }
  }

  return await sendEmail({ to: email, subject, html, text });
};

module.exports = {
  generateOTP,
  sendOTP,
  sendAdminInvitation,
  sendStudentPasswordReset,
  sendForgotPasswordOTP,
};

