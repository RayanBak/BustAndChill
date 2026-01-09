import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token de vérification requis' },
        { status: 400 }
      );
    }
    
    // Find token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
    
    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Token de vérification invalide ou expiré' },
        { status: 400 }
      );
    }
    
    // Check expiration
    if (verificationToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });
      
      return NextResponse.json(
        { error: 'Le token de vérification a expiré. Veuillez vous réinscrire.' },
        { status: 400 }
      );
    }
    
    // Check if already verified
    if (verificationToken.user.emailVerifiedAt) {
      return NextResponse.json({
        success: true,
        message: 'Email déjà vérifié. Vous pouvez vous connecter.',
        alreadyVerified: true,
      });
    }
    
    // Verify email
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: new Date() },
    });
    
    // Delete token
    await prisma.emailVerificationToken.delete({
      where: { id: verificationToken.id },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Email vérifié avec succès ! Vous pouvez maintenant vous connecter.',
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Échec de la vérification de l\'email. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}


