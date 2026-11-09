import { NextResponse } from 'next/server';

export async function GET() {
  // Vercel automatically injects a unique deployment ID for every push
  const version = process.env.VERCEL_DEPLOYMENT_ID || 'development';
  
  return NextResponse.json(
    { version },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    }
  );
}