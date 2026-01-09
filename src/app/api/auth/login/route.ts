import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Email ou mot de passe invalide' },
        { status: 401 }
      );
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Email ou mot de passe invalide' },
        { status: 401 }
      );
    }
    
    // Check email verification
    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { error: 'Veuillez vérifier votre email avant de vous connecter. Vérifiez votre boîte de réception pour le lien de vérification.' },
        { status: 403 }
      );
    }
    
    // Set auth cookie
    await setAuthCookie({
      userId: user.id,
      email: user.email,
      username: user.username,
    });
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        username: user.username,
      },
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Échec de la connexion. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}


