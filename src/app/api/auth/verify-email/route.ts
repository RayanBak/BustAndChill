import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  // Utiliser NEXT_PUBLIC_APP_URL au lieu de request.url pour éviter les redirections vers 0.0.0.0:8080
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      // Rediriger vers la page de login avec un message d'erreur
      const loginUrl = new URL('/login?error=missing_token', baseUrl);
      return NextResponse.redirect(loginUrl);
    }
    
    // Find token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
    
    if (!verificationToken) {
      // Rediriger vers la page de login avec un message d'erreur
      const loginUrl = new URL('/login?error=invalid_token', baseUrl);
      return NextResponse.redirect(loginUrl);
    }
    
    // Check expiration
    if (verificationToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });
      
      // Rediriger vers la page de login avec un message d'erreur
      const loginUrl = new URL('/login?error=expired_token', baseUrl);
      return NextResponse.redirect(loginUrl);
    }
    
    // Check if already verified
    if (verificationToken.user.emailVerifiedAt) {
      // Rediriger vers login avec un message indiquant que c'est déjà vérifié
      const loginUrl = new URL('/login?verified=already', baseUrl);
      return NextResponse.redirect(loginUrl);
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
    
    // Rediriger vers la page de login avec un message de succès
    const loginUrl = new URL('/login?verified=1', baseUrl);
    return NextResponse.redirect(loginUrl);
    
  } catch (error) {
    console.error('Email verification error:', error);
    // Rediriger vers la page de login avec un message d'erreur
    const loginUrl = new URL('/login?error=verification_failed', baseUrl);
    return NextResponse.redirect(loginUrl);
  }
}


