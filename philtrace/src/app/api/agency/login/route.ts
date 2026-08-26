import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

interface LoginBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json() as LoginBody;

    if (!email || !password) {
      return Response.json(
        { error: 'email and password are required' },
        { status: 400 }
      );
    }

    const account = await prisma.agencyAccount.findUnique({
      where: { email },
    });

    if (!account) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(password, account.passwordHash);
    if (!validPassword) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      { id: account.id, email: account.email, agencyName: account.agencyName },
      env.JWT_SECRET(),
      { expiresIn: '24h' }
    );

    const response = Response.json({
      success: true,
      agencyName: account.agencyName,
    });

    // Set httpOnly cookie
    const headers = new Headers(response.headers);
    headers.set(
      'Set-Cookie',
      `agency_token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
