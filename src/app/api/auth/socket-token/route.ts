import { NextResponse } from 'next/server';
import { getAuthFromCookie, generateToken } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getAuthFromCookie();
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Generate a token for Socket.IO authentication
    const token = generateToken({
      userId: auth.userId,
      email: auth.email,
      username: auth.username,
    });
    
    return NextResponse.json({
      success: true,
      token,
    });
    
  } catch (error) {
    console.error('Socket token error:', error);
    return NextResponse.json(
      { error: 'Failed to generate socket token' },
      { status: 500 }
    );
  }
}

