const transporter = require('../config/email');

/**
 * Send OTP email to user for login or reset password
 */
async function sendOTPEmail({ to, name, otp, type = 'login' }) {
    const subject =
        type === 'login'
            ? '🔐 Your YB News OTP Code'
            : '🔑 Reset Your YB News Password';

    const actionText =
        type === 'login'
            ? 'complete your login'
            : 'reset your password';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #e94560; margin: 0; font-size: 28px; letter-spacing: 1px; }
    .header span { color: #fff; font-size: 14px; opacity: 0.7; }
    .body { padding: 40px; }
    .body p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .otp-box { background: #f8f9fa; border: 2px dashed #e94560; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; color: #1a1a2e; letter-spacing: 8px; }
    .warning { font-size: 13px; color: #888; margin-top: 8px; }
    .footer { background: #f8f9fa; padding: 20px 40px; text-align: center; }
    .footer p { color: #aaa; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>YB News</h1>
      <span>Your daily news source</span>
    </div>
    <div class="body">
      <p>Hi <strong>${name}</strong>,</p>
      <p>Use the code below to <strong>${actionText}</strong>:</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="warning">⏱ This code expires in <strong>3 minutes</strong></div>
      </div>
      <p>If you did not request this, please ignore this email. Your account is safe.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} YB News. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        text: `Your YB News OTP code is: ${otp}\nIt expires in 3 minutes.`,
    });
}

module.exports = { sendOTPEmail };
