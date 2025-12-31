import { NextResponse } from 'next/server';

// Socket.IO is handled by the custom server
// This route just confirms the socket endpoint exists
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Socket.IO endpoint - use WebSocket connection',
  });
}


