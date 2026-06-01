// session.ts
// Handles secure, predefined system accounts authentication and sessions for the Knitwear ERP.
import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPERADMIN' | 'ACCOUNTS' | 'INVENTORY' | 'RETAIL';
  active: boolean;
}

const SALT = 'ljk_salt_2026';

// Predefined Fixed System Accounts with Secure Password Hashes
export const FIXED_ACCOUNTS = [
  {
    id: 'usr-superadmin',
    username: 'Khanna',
    fullName: 'Super Admin',
    role: 'SUPERADMIN' as const,
    passwordHash: '4c4f45b369fd79083ba08e16049c07d1207850f4e69c25e1b7ec95bc0b081a5d', // Kushy@2026
    active: true
  },
  {
    id: 'usr-accounts',
    username: 'accounts',
    fullName: 'Accounts Department',
    role: 'ACCOUNTS' as const,
    passwordHash: '91603527c5ef50f016d40e76d57c2347a029742545cc7c3aa41d1d2899a6ca85', // Factory@99
    active: true
  },
  {
    id: 'usr-inventory',
    username: 'inventory',
    fullName: 'Inventory Department',
    role: 'INVENTORY' as const,
    passwordHash: '91603527c5ef50f016d40e76d57c2347a029742545cc7c3aa41d1d2899a6ca85', // Factory@99
    active: true
  },
  {
    id: 'usr-retail',
    username: 'retail',
    fullName: 'Retail Department',
    role: 'RETAIL' as const,
    passwordHash: '91603527c5ef50f016d40e76d57c2347a029742545cc7c3aa41d1d2899a6ca85', // Factory@99
    active: true
  }
];

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const username = cookieStore.get('ljk_user')?.value;
  if (!username) return null;

  const account = FIXED_ACCOUNTS.find(acc => acc.username === username);
  if (!account) return null;

  return {
    id: account.id,
    username: account.username,
    fullName: account.fullName,
    role: account.role,
    active: account.active
  };
}

export async function authenticateUser(username: string, password: string): Promise<UserSession | null> {
  const account = FIXED_ACCOUNTS.find(acc => acc.username.toLowerCase() === username.trim().toLowerCase());
  if (!account) return null;

  const inputHash = hashPassword(password);
  if (inputHash !== account.passwordHash) return null;

  const cookieStore = await cookies();
  // Store session in secure cookie
  cookieStore.set('ljk_user', account.username, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 // 24 hours session
  });

  return {
    id: account.id,
    username: account.username,
    fullName: account.fullName,
    role: account.role,
    active: account.active
  };
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('ljk_user');
}
