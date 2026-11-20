import { NextResponse } from 'next/server';

// Permanent tenant deletion is intentionally disabled until an audited,
// transactional account-retirement workflow is implemented. Use suspension.
export async function POST() {
  return NextResponse.json(
    { error: 'Permanent company deletion is disabled. Suspend the company instead to preserve its users and audit history.' },
    { status: 410 },
  );
}
