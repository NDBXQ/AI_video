import { NextRequest, NextResponse } from 'next/server';

const isInternalApiEnabled = () => process.env.INTERNAL_API_ENABLED === 'true' || process.env.NODE_ENV !== 'production';

export const config = {
  matcher: ['/api/internal/:path*'],
};

export function middleware(_request: NextRequest) {
  if (!isInternalApiEnabled()) {
    return NextResponse.json({ success: false, message: 'Not Found' }, { status: 404 });
  }

  return NextResponse.next();
}

