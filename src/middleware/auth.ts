import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/auth/session';
import { RequestWithSession } from '@/types/auth';

/**
 * Base authentication middleware
 *
 * Ensures user is logged in and has a valid session
 * Attaches session context to request object
 *
 * Returns 401 if not authenticated
 */
export async function requireAuth(
  request: NextRequest,
  handler: (req: RequestWithSession) => Promise<Response>
): Promise<Response> {
  const session = await getSessionContext();

  if (!session) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource',
      },
      { status: 401 }
    );
  }

  // Attach session to request
  const requestWithSession = request as RequestWithSession;
  requestWithSession.session = session;

  return handler(requestWithSession);
}
