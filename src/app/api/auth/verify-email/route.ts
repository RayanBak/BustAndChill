import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
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
        { error: 'Invalid or expired verification token' },
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
        { error: 'Verification token has expired. Please register again.' },
        { status: 400 }
      );
    }
    
    // Check if already verified
    if (verificationToken.user.emailVerifiedAt) {
      return NextResponse.json({
        success: true,
        message: 'Email already verified. You can log in.',
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
      message: 'Email verified successfully! You can now log in.',
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Email verification failed. Please try again.' },
      { status: 500 }
    );
  }
}


