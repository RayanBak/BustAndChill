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
        return NextResponse.json(
          { error: 'Email déjà enregistré' },
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
    
    // Send verification email
    await sendVerificationEmail(user.email, user.username, token);
    
    return NextResponse.json({
      success: true,
      message: 'Inscription réussie ! Veuillez vérifier votre email pour valider votre compte.',
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Échec de l\'inscription. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}


