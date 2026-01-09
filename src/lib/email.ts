import nodemailer from 'nodemailer';
import mjml2html from 'mjml';

// Configuration SMTP pour production et développement
function createTransporter() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // En production, on exige les variables SMTP
  if (isProduction) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
      console.error('❌ SMTP configuration missing in production!');
      console.error('Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM');
      throw new Error('SMTP configuration is required in production');
    }
  }
  
  // Détection automatique du port sécurisé (TLS)
  const port = parseInt(process.env.SMTP_PORT || '1025');
  const secure = port === 465 || process.env.SMTP_SECURE === 'true';
  
  // Support pour les services SMTP populaires
  const smtpHost = process.env.SMTP_HOST || 'localhost';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  // Configuration de base
  const config: any = {
    host: smtpHost,
    port,
    secure,
    auth: smtpUser && smtpPass ? {
      user: smtpUser,
      pass: smtpPass,
    } : undefined,
  };
  
  // Configuration spécifique pour certains services
  if (smtpHost.includes('gmail.com') || smtpHost.includes('googlemail.com')) {
    // Gmail peut utiliser port 587 (STARTTLS) ou 465 (SSL)
    if (port === 465) {
      config.secure = true;
      config.port = 465;
    } else {
      // Port 587 avec STARTTLS
      config.secure = false;
      config.port = 587;
      config.requireTLS = true;
    }
    config.service = 'gmail';
  } else if (smtpHost.includes('sendgrid')) {
    config.secure = false;
    config.port = 587;
    config.requireTLS = true;
  } else if (smtpHost.includes('resend.com') || smtpHost.includes('resend')) {
    // Resend SMTP utilise le port 465 avec SSL
    config.secure = true;
    config.port = 465;
  } else if (smtpHost.includes('mailgun.org')) {
    // Mailgun utilise le port 587 avec STARTTLS
    config.secure = false;
    config.port = 587;
    config.requireTLS = true;
  }
  
  // Support pour TLS explicite (port 587 par défaut)
  if (port === 587 && !config.requireTLS) {
    config.secure = false;
    config.requireTLS = true;
  }
  
  const transporter = nodemailer.createTransport(config);
  
  // Test de la connexion en production (une fois au démarrage)
  if (isProduction && smtpHost !== 'localhost') {
    transporter.verify().then(() => {
      console.log('✅ SMTP server connection verified');
    }).catch((error) => {
      console.error('❌ SMTP server connection failed:', error.message);
      console.error('Please check your SMTP configuration');
    });
  }
  
  return transporter;
}

const transporter = createTransporter();

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
  
  const isProduction = process.env.NODE_ENV === 'production';
  const smtpFrom = process.env.SMTP_FROM || 'noreply@bustandchill.local';
  
  // Vérification en production
  if (isProduction && !process.env.SMTP_HOST) {
    console.error('❌ Cannot send email: SMTP not configured in production');
    return false;
  }
  
  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: '🃏 Verify your email - Bust & Chill',
      html,
      text: `Welcome to Bust & Chill, ${username}!\n\nPlease verify your email by visiting: ${verificationUrl}\n\nThis link expires in 24 hours.`,
    });
    
    console.log('✅ Email sent successfully:', info.messageId);
    console.log('   To:', email);
    console.log('   Subject: Verify your email - Bust & Chill');
    
    // En développement, afficher aussi l'URL pour faciliter les tests
    if (!isProduction) {
      console.log('📧 Verification URL (dev):', verificationUrl);
    }
    
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send email:', error.message);
    
    // Détails supplémentaires pour le débogage
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.command) {
      console.error('   Failed command:', error.command);
    }
    if (error.response) {
      console.error('   SMTP response:', error.response);
    }
    
    // En développement, on peut continuer pour les tests (MailHog local)
    if (!isProduction) {
      console.log('='.repeat(60));
      console.log('⚠️  EMAIL SENDING FAILED - Development mode');
      console.log('   Verification URL for testing:', verificationUrl);
      console.log('='.repeat(60));
      return true; // Permettre de continuer en dev même si SMTP échoue
    }
    
    // En production, c'est une erreur critique
    return false;
  }
}


