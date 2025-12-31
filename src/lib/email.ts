import nodemailer from 'nodemailer';
import mjml2html from 'mjml';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

const verifyEmailMjml = (username: string, verificationUrl: string) => `
<mjml>
  <mj-head>
    <mj-title>Verify Your Email - Bust & Chill</mj-title>
    <mj-attributes>
      <mj-all font-family="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" />
      <mj-text font-size="16px" color="#333333" line-height="1.6" />
    </mj-attributes>
    <mj-style>
      .cta-button { background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%); }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#1a472a" padding="30px 20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="32px" font-weight="bold">
          🃏 Bust & Chill
        </mj-text>
        <mj-text align="center" color="#fbbf24" font-size="16px">
          Blackjack Multiplayer
        </mj-text>
      </mj-column>
    </mj-section>
    
    <mj-section background-color="#ffffff" padding="40px 30px" border-radius="0 0 8px 8px">
      <mj-column>
        <mj-text font-size="24px" color="#1a472a" font-weight="bold">
          Welcome, ${username}! 👋
        </mj-text>
        <mj-text>
          Thanks for signing up for Bust & Chill! To complete your registration and start playing, please verify your email address.
        </mj-text>
        <mj-button background-color="#1a472a" color="#ffffff" font-size="18px" padding="20px 0" href="${verificationUrl}" border-radius="8px">
          Verify My Email
        </mj-button>
        <mj-text font-size="14px" color="#666666">
          Or copy and paste this link in your browser:
        </mj-text>
        <mj-text font-size="12px" color="#1a472a" word-break="break-all">
          ${verificationUrl}
        </mj-text>
        <mj-divider border-color="#e0e0e0" padding="20px 0" />
        <mj-text font-size="14px" color="#999999">
          This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
        </mj-text>
      </mj-column>
    </mj-section>
    
    <mj-section padding="20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#999999">
          © 2024 Bust & Chill - Local Multiplayer Blackjack
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationUrl = `${appUrl}/verify-email?token=${token}`;
  
  const mjmlTemplate = verifyEmailMjml(username, verificationUrl);
  const { html, errors } = mjml2html(mjmlTemplate);
  
  if (errors.length > 0) {
    console.error('MJML compilation errors:', errors);
  }
  
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@bustandchill.local',
      to: email,
      subject: '🃏 Verify your email - Bust & Chill',
      html,
      text: `Welcome to Bust & Chill, ${username}!\n\nPlease verify your email by visiting: ${verificationUrl}\n\nThis link expires in 24 hours.`,
    });
    
    console.log('Email sent:', info.messageId);
    
    // In development, log the preview URL if using MailHog or similar
    if (process.env.NODE_ENV === 'development') {
      console.log('Verification URL:', verificationUrl);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    // In development, still return true and log the URL for testing
    if (process.env.NODE_ENV === 'development') {
      console.log('='.repeat(60));
      console.log('EMAIL SENDING FAILED - Development fallback');
      console.log('Verification URL:', verificationUrl);
      console.log('='.repeat(60));
      return true;
    }
    return false;
  }
}


