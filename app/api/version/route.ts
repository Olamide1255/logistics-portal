import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensures this route is never cached

export async function GET() {
  // Vercel automatically injects a unique deployment ID for every push
  const version = process.env.VERCEL_DEPLOYMENT_ID || 'development';
  
  return NextResponse.json({ version });
}