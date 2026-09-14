import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Load balancer probe: reports unhealthy only when the database is unreachable. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up' });
  } catch (err) {
    return NextResponse.json(
      { status: 'degraded', database: 'down', error: String(err).slice(0, 200) },
      { status: 503 },
    );
  }
}
