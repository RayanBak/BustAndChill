import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, generateVerificationToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { isValidEmail, isValidUsername, isValidPassword } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstname, lastname, email, username, password } = body;
    
    // Validation
    if (!firstname || !lastname || !email || !username || !password) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }
    
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Format d\'email invalide' },
        { status: 400 }
      );
    }
    
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Le nom d\'utilisateur doit contenir 3-20 caractères et uniquement des lettres, chiffres et underscores' },
        { status: 400 }
      );
    }
    
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() },
        ],
      },
    });
    
    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        // Si l'email existe mais n'est pas vérifié, on peut renvoyer l'email
        if (!existingUser.emailVerifiedAt) {
          console.log('📧 [REGISTER API] Email existant mais non vérifié, renvoi de l\'email...');
          
          // Supprimer les anciens tokens
          await prisma.emailVerificationToken.deleteMany({
            where: { userId: existingUser.id },
          });
          
          // Créer un nouveau token
          const token = generateVerificationToken();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          
          await prisma.emailVerificationToken.create({
            data: {
              userId: existingUser.id,
              token,
              expiresAt,
            },
          });
          
          console.log('📧 [REGISTER API] Nouveau token créé pour l\'utilisateur existant');
          console.log('📧 [REGISTER API] Tentative d\'envoi d\'email...');
          
          // Renvoyer l'email de vérification avec timeout
          console.log('📧 [REGISTER API] Tentative d\'envoi d\'email avec timeout de 15s...');
          const emailSentPromise = sendVerificationEmail(existingUser.email, existingUser.username, token);
          const timeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => {
              console.error('⏱️ [REGISTER API] Timeout lors du renvoi d\'email (15s)');
              resolve(false);
            }, 15000);
          });
          
          const emailSent = await Promise.race([emailSentPromise, timeoutPromise]).catch((err) => {
            console.error('❌ [REGISTER API] Erreur lors du renvoi d\'email:', err);
            console.error('❌ [REGISTER API] Type:', err?.constructor?.name);
            console.error('❌ [REGISTER API] Message:', err?.message);
            return false;
          });
          
          if (emailSent) {
            console.log('✅ [REGISTER API] Email de vérification renvoyé avec succès');
            return NextResponse.json({
              success: true,
              message: 'Un nouvel email de vérification a été envoyé. Vérifiez votre boîte de réception (et les spams).',
              emailSent: true,
              existingUser: true,
            });
          } else {
            console.warn('⚠️ [REGISTER API] Échec du renvoi d\'email (timeout ou erreur SMTP)');
            console.warn('⚠️ [REGISTER API] Token de vérification (pour debug):', token.substring(0, 20) + '...');
            return NextResponse.json({
              success: false,
              error: 'Votre compte existe mais n\'est pas vérifié. L\'envoi de l\'email a échoué (timeout ou erreur SMTP). Vérifiez la configuration SMTP sur Railway ou contactez le support.',
              emailSent: false,
              existingUser: true,
            }, { status: 400 });
          }
        }
        
        // Email déjà vérifié
        return NextResponse.json(
          { error: 'Cet email est déjà enregistré et vérifié. Vous pouvez vous connecter.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Nom d\'utilisateur déjà pris' },
        { status: 400 }
      );
    }
    
    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        firstname,
        lastname,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        passwordHash,
      },
    });
    
    // Create verification token
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
    
    console.log('📧 [REGISTER API] Préparation de l\'envoi d\'email de vérification...');
    console.log('📧 [REGISTER API] Email:', user.email);
    console.log('📧 [REGISTER API] Token généré:', token.substring(0, 20) + '...');
    
    // Send verification email (ne bloque pas l'inscription si ça échoue)
    const emailSent = await sendVerificationEmail(user.email, user.username, token).catch((err) => {
      console.error('❌ [REGISTER API] Erreur lors de l\'envoi d\'email (non-bloquant):', err);
      console.error('❌ [REGISTER API] Type d\'erreur:', err?.constructor?.name);
      console.error('❌ [REGISTER API] Message:', err?.message);
      return false;
    });
    
    console.log('📧 [REGISTER API] Résultat de l\'envoi d\'email:', emailSent ? '✅ SUCCÈS' : '❌ ÉCHEC');
    
    // L'utilisateur est créé même si l'email échoue
    // On informe l'utilisateur mais on ne bloque pas l'inscription
    if (!emailSent) {
      console.warn(`⚠️ [REGISTER API] Email non envoyé pour ${user.email}, mais l'utilisateur est créé`);
      console.warn(`⚠️ [REGISTER API] ID utilisateur: ${user.id}`);
      console.warn(`⚠️ [REGISTER API] Token de vérification: ${token}`);
      return NextResponse.json({
        success: true,
        message: 'Inscription réussie ! Cependant, l\'envoi de l\'email a échoué. Veuillez contacter le support.',
        emailSent: false,
      });
    }
    
    console.log('✅ [REGISTER API] Inscription complète et email envoyé avec succès');
    return NextResponse.json({
      success: true,
      message: 'Inscription réussie ! Veuillez vérifier votre email pour valider votre compte.',
      emailSent: true,
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Échec de l\'inscription. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}


