import nodemailer from 'nodemailer';
import mjml2html from 'mjml';

// Configuration SMTP pour production et développement
function createTransporter() {
  console.log('🔧 [SMTP] ========== INITIALISATION TRANSPORTER ==========');
  const isProduction = process.env.NODE_ENV === 'production';
  console.log('🔧 [SMTP] Mode:', isProduction ? 'PRODUCTION' : 'DÉVELOPPEMENT');
  
  // En production, on exige les variables SMTP
  if (isProduction) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
      console.error('❌ [SMTP] Configuration manquante en production !');
      console.error('❌ [SMTP] Variables requises: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM');
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
  
  console.log('🔧 [SMTP] Configuration détectée:');
  console.log('🔧 [SMTP]   Host:', smtpHost);
  console.log('🔧 [SMTP]   Port:', port);
  console.log('🔧 [SMTP]   Secure:', secure);
  console.log('🔧 [SMTP]   User:', smtpUser ? `${smtpUser.substring(0, 3)}***` : 'non défini');
  console.log('🔧 [SMTP]   Pass:', smtpPass ? '***' + smtpPass.substring(smtpPass.length - 3) : 'non défini');
  
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
    console.log('🔧 [SMTP] Service Gmail détecté');
    // Gmail peut utiliser port 587 (STARTTLS) ou 465 (SSL)
    if (port === 465) {
      config.secure = true;
      config.port = 465;
      console.log('🔧 [SMTP]   Mode: SSL (port 465)');
    } else {
      // Port 587 avec STARTTLS
      config.secure = false;
      config.port = 587;
      config.requireTLS = true;
      console.log('🔧 [SMTP]   Mode: STARTTLS (port 587)');
    }
    config.service = 'gmail';
  } else if (smtpHost.includes('sendgrid')) {
    console.log('🔧 [SMTP] Service SendGrid détecté');
    config.secure = false;
    config.port = 587;
    config.requireTLS = true;
  } else if (smtpHost.includes('resend.com') || smtpHost.includes('resend')) {
    console.log('🔧 [SMTP] Service Resend détecté');
    config.secure = true;
    config.port = 465;
  } else if (smtpHost.includes('mailgun.org')) {
    console.log('🔧 [SMTP] Service Mailgun détecté');
    config.secure = false;
    config.port = 587;
    config.requireTLS = true;
  } else {
    console.log('🔧 [SMTP] Service SMTP générique');
  }
  
  // Support pour TLS explicite (port 587 par défaut)
  if (port === 587 && !config.requireTLS) {
    config.secure = false;
    config.requireTLS = true;
    console.log('🔧 [SMTP] TLS explicite activé pour le port 587');
  }
  
  console.log('🔧 [SMTP] Configuration finale:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    service: config.service,
    hasAuth: !!config.auth
  });
  
  const transporter = nodemailer.createTransport(config);
  
  // Test de la connexion en production (une fois au démarrage) - ASYNCHRONE pour ne pas bloquer
  if (isProduction && smtpHost !== 'localhost') {
    console.log('🔧 [SMTP] Vérification de la connexion SMTP (asynchrone)...');
    transporter.verify().then(() => {
      console.log('✅ [SMTP] Connexion SMTP vérifiée avec succès');
    }).catch((error) => {
      console.error('❌ [SMTP] Échec de la vérification de connexion:', error.message);
      console.error('❌ [SMTP] Code:', error.code);
      console.error('❌ [SMTP] Vérifiez votre configuration SMTP');
      console.error('❌ [SMTP] Variables requises: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
    });
  } else if (!isProduction) {
    console.log('🔧 [SMTP] Mode développement - pas de vérification de connexion');
  }
  
  console.log('🔧 [SMTP] ========== TRANSPORTER INITIALISÉ ==========\n');
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
          Blackjack Multijoueur
        </mj-text>
      </mj-column>
    </mj-section>
    
    <mj-section background-color="#ffffff" padding="40px 30px" border-radius="0 0 8px 8px">
      <mj-column>
        <mj-text font-size="24px" color="#1a472a" font-weight="bold">
          Bienvenue, ${username} ! 👋
        </mj-text>
        <mj-text>
          Merci de vous être inscrit sur Bust & Chill ! Pour compléter votre inscription et commencer à jouer, veuillez vérifier votre adresse email.
        </mj-text>
        <mj-button background-color="#1a472a" color="#ffffff" font-size="18px" padding="20px 0" href="${verificationUrl}" border-radius="8px">
          Vérifier mon email
        </mj-button>
        <mj-text font-size="14px" color="#666666">
          Ou copiez et collez ce lien dans votre navigateur :
        </mj-text>
        <mj-text font-size="12px" color="#1a472a" word-break="break-all">
          ${verificationUrl}
        </mj-text>
        <mj-divider border-color="#e0e0e0" padding="20px 0" />
        <mj-text font-size="14px" color="#999999">
          Ce lien expirera dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
        </mj-text>
      </mj-column>
    </mj-section>
    
    <mj-section padding="20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#999999">
          © 2024 Bust & Chill - Blackjack Multijoueur
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
  console.log('📧 [EMAIL] ========== DÉBUT ENVOI EMAIL ==========');
  console.log('📧 [EMAIL] Destinataire:', email);
  console.log('📧 [EMAIL] Nom d\'utilisateur:', username);
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationUrl = `${appUrl}/verify-email?token=${token}`;
  console.log('📧 [EMAIL] URL de vérification:', verificationUrl);
  console.log('📧 [EMAIL] APP_URL configuré:', appUrl);
  
  const mjmlTemplate = verifyEmailMjml(username, verificationUrl);
  const { html, errors } = mjml2html(mjmlTemplate);
  
  if (errors.length > 0) {
    console.error('❌ [EMAIL] Erreurs de compilation MJML:', errors);
  } else {
    console.log('✅ [EMAIL] Template MJML compilé avec succès');
  }
  
  const isProduction = process.env.NODE_ENV === 'production';
  const smtpFrom = process.env.SMTP_FROM || 'noreply@bustandchill.local';
  
  console.log('📧 [EMAIL] ========== CONFIGURATION SMTP ==========');
  console.log('📧 [EMAIL] NODE_ENV:', process.env.NODE_ENV || 'non défini');
  console.log('📧 [EMAIL] SMTP_HOST:', process.env.SMTP_HOST || '❌ NON DÉFINI');
  console.log('📧 [EMAIL] SMTP_PORT:', process.env.SMTP_PORT || '❌ NON DÉFINI');
  console.log('📧 [EMAIL] SMTP_USER:', process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}*** (longueur: ${process.env.SMTP_USER.length})` : '❌ NON DÉFINI');
  console.log('📧 [EMAIL] SMTP_PASS:', process.env.SMTP_PASS ? `***${process.env.SMTP_PASS.substring(process.env.SMTP_PASS.length - 3)} (longueur: ${process.env.SMTP_PASS.length})` : '❌ NON DÉFINI');
  console.log('📧 [EMAIL] SMTP_FROM:', smtpFrom);
  console.log('📧 [EMAIL] SMTP_SECURE:', process.env.SMTP_SECURE || 'auto');
  console.log('📧 [EMAIL] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || '❌ NON DÉFINI');
  
  // Vérification en production
  if (isProduction && !process.env.SMTP_HOST) {
    console.error('❌ [EMAIL] ========== ERREUR CONFIGURATION ==========');
    console.error('❌ [EMAIL] SMTP non configuré en production !');
    console.error('❌ [EMAIL] L\'utilisateur sera créé mais l\'email de vérification ne fonctionnera pas');
    console.error('❌ [EMAIL] Variables requises: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM');
    console.error('❌ [EMAIL] ACTION: Allez sur Railway → Variables → Raw Editor et ajoutez ces variables');
    return false;
  }
  
  // Vérifier que toutes les variables nécessaires sont présentes
  const missingVars: string[] = [];
  if (!process.env.SMTP_HOST) missingVars.push('SMTP_HOST');
  if (!process.env.SMTP_PORT) missingVars.push('SMTP_PORT');
  if (!process.env.SMTP_USER) missingVars.push('SMTP_USER');
  if (!process.env.SMTP_PASS) missingVars.push('SMTP_PASS');
  if (!process.env.NEXT_PUBLIC_APP_URL) missingVars.push('NEXT_PUBLIC_APP_URL');
  
  if (missingVars.length > 0) {
    console.error('❌ [EMAIL] Variables manquantes:', missingVars.join(', '));
    console.error('❌ [EMAIL] L\'envoi d\'email va probablement échouer');
    if (isProduction) {
      console.error('❌ [EMAIL] ACTION REQUISE: Ajoutez ces variables dans Railway → Variables → Raw Editor');
    }
  } else {
    console.log('✅ [EMAIL] Toutes les variables SMTP sont présentes');
  }
  
  try {
    console.log('📧 [EMAIL] ========== TENTATIVE D\'ENVOI ==========');
    console.log('📧 [EMAIL] From:', smtpFrom);
    console.log('📧 [EMAIL] To:', email);
    console.log('📧 [EMAIL] Subject: 🃏 Vérifiez votre email - Bust & Chill');
    
    const mailOptions = {
      from: smtpFrom,
      to: email,
      subject: '🃏 Vérifiez votre email - Bust & Chill',
      html,
      text: `Bienvenue sur Bust & Chill, ${username} !\n\nVeuillez vérifier votre email en visitant : ${verificationUrl}\n\nCe lien expire dans 24 heures.`,
    };
    
    console.log('📧 [EMAIL] Envoi via transporter...');
    const smtpPort = parseInt(process.env.SMTP_PORT || '1025');
    console.log('📧 [EMAIL] Configuration utilisée:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: smtpPort === 465 || process.env.SMTP_SECURE === 'true',
      hasAuth: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    });
    
    // Timeout pour éviter que ça bloque indéfiniment (15 secondes pour SMTP)
    console.log('📧 [EMAIL] Démarrage de l\'envoi avec timeout de 15 secondes...');
    const startTime = Date.now();
    
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        console.error(`⏱️ [EMAIL] Timeout après ${elapsed}ms: L'envoi d'email a pris trop de temps`);
        console.error('⏱️ [EMAIL] Cela indique probablement un problème de connexion SMTP');
        console.error('⏱️ [EMAIL] Vérifiez: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
        reject(new Error('Timeout: L\'envoi d\'email a pris plus de 15 secondes'));
      }, 15000);
    });
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    const elapsed = Date.now() - startTime;
    console.log(`⏱️ [EMAIL] Envoi réussi en ${elapsed}ms`);
    
    console.log('✅ [EMAIL] ========== EMAIL ENVOYÉ AVEC SUCCÈS ==========');
    console.log('✅ [EMAIL] Message ID:', info.messageId);
    console.log('✅ [EMAIL] Réponse SMTP:', info.response || 'Pas de réponse');
    console.log('✅ [EMAIL] Acceptés:', info.accepted || []);
    console.log('✅ [EMAIL] Rejetés:', info.rejected || []);
    if ('pending' in info) {
      console.log('✅ [EMAIL] Pending:', (info as any).pending || []);
    }
    
    // En développement, afficher aussi l'URL pour faciliter les tests
    if (!isProduction) {
      console.log('📧 [EMAIL] URL de vérification (dev):', verificationUrl);
    }
    
    return true;
  } catch (error: any) {
    console.error('❌ [EMAIL] ========== ERREUR LORS DE L\'ENVOI ==========');
    console.error('❌ [EMAIL] Message d\'erreur:', error.message);
    console.error('❌ [EMAIL] Type d\'erreur:', error.constructor?.name || 'Unknown');
    
    // Détails supplémentaires pour le débogage
    if (error.code) {
      console.error('❌ [EMAIL] Code d\'erreur:', error.code);
    }
    if (error.errno) {
      console.error('❌ [EMAIL] Errno:', error.errno);
    }
    if (error.syscall) {
      console.error('❌ [EMAIL] Syscall:', error.syscall);
    }
    if (error.hostname) {
      console.error('❌ [EMAIL] Hostname:', error.hostname);
    }
    if (error.port) {
      console.error('❌ [EMAIL] Port:', error.port);
    }
    if (error.command) {
      console.error('❌ [EMAIL] Commande échouée:', error.command);
    }
    if (error.response) {
      console.error('❌ [EMAIL] Réponse SMTP:', error.response);
    }
    if (error.responseCode) {
      console.error('❌ [EMAIL] Code de réponse SMTP:', error.responseCode);
    }
    if (error.command) {
      console.error('❌ [EMAIL] Commande:', error.command);
    }
    
    // Stack trace complète
    if (error.stack) {
      console.error('❌ [EMAIL] Stack trace:', error.stack);
    }
    
    // Log de l'URL de vérification même en cas d'échec pour faciliter le débogage
    console.error('📧 [EMAIL] URL de vérification (à utiliser manuellement):', verificationUrl);
    
    // En développement, on peut continuer pour les tests (MailHog local)
    if (!isProduction) {
      console.log('⚠️ [EMAIL] ========== MODE DÉVELOPPEMENT ==========');
      console.log('⚠️ [EMAIL] Envoi d\'email échoué mais mode dev activé');
      console.log('⚠️ [EMAIL] L\'inscription continue quand même');
      console.log('⚠️ [EMAIL] URL de vérification pour tests:', verificationUrl);
      return true; // Permettre de continuer en dev même si SMTP échoue
    }
    
    // En production, on retourne false mais ne bloque pas l'inscription
    console.error('❌ [EMAIL] Échec en production - l\'inscription continue mais l\'email n\'est pas envoyé');
    return false;
  } finally {
    console.log('📧 [EMAIL] ========== FIN PROCESSUS EMAIL ==========\n');
  }
}


