/**
 * Unit tests for authentication utilities
 *
 * Validates Requirements 18.5, 18.10:
 *   - 18.5  Test JWT token generation and verification
 *   - 18.10 Target 80% code coverage for authentication logic
 *
 * Also covers:
 *   - Password hashing and comparison (Req 21.1–21.3)
 *   - Token extraction from headers and cookies
 */

import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  extractTokenFromCookie,
} from './auth';

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

describe('hashPassword / comparePassword', () => {
  it('hashes a password and returns a bcrypt hash string', async () => {
    const hash = await hashPassword('MyPassword123!');
    expect(hash).toBeDefined();
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    expect(hash).not.toBe('MyPassword123!');
  });

  it('comparePassword returns true for the correct password', async () => {
    const hash = await hashPassword('CorrectPassword1!');
    const result = await comparePassword('CorrectPassword1!', hash);
    expect(result).toBe(true);
  });

  it('comparePassword returns false for an incorrect password', async () => {
    const hash = await hashPassword('CorrectPassword1!');
    const result = await comparePassword('WrongPassword99!', hash);
    expect(result).toBe(false);
  });

  it('produces different hashes for the same password (salt randomness)', async () => {
    const hash1 = await hashPassword('SamePassword1!');
    const hash2 = await hashPassword('SamePassword1!');
    expect(hash1).not.toBe(hash2);
  });

  it('comparePassword returns false for an empty string against a real hash', async () => {
    const hash = await hashPassword('RealPassword1!');
    const result = await comparePassword('', hash);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// JWT generation and verification
// ---------------------------------------------------------------------------

describe('generateToken / verifyToken', () => {
  const payload = {
    userId: 'user-001',
    email: 'test@example.com',
    role: 'local_admin',
    tenantId: 'tenant-001',
  };

  it('generates a non-empty JWT string', () => {
    const token = generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('verifyToken returns the correct payload for a valid token', () => {
    const token = generateToken(payload);
    const decoded = verifyToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(payload.userId);
    expect(decoded!.email).toBe(payload.email);
    expect(decoded!.role).toBe(payload.role);
    expect(decoded!.tenantId).toBe(payload.tenantId);
  });

  it('verifyToken includes a jti field', () => {
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded!.jti).toBeDefined();
    expect(typeof decoded!.jti).toBe('string');
  });

  it('verifyToken returns null for a tampered token', () => {
    const token = generateToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('verifyToken returns null for a completely invalid string', () => {
    expect(verifyToken('not.a.jwt')).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('random-string')).toBeNull();
  });

  it('verifyToken returns null for a token signed with a different secret', () => {
    const jwt = require('jsonwebtoken');
    const fakeToken = jwt.sign(
      { ...payload, jti: 'fake-jti' },
      'wrong-secret',
      { expiresIn: 3600 }
    );
    expect(verifyToken(fakeToken)).toBeNull();
  });

  it('verifyToken returns null for an expired token', () => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET!;
    const expiredToken = jwt.sign(
      { ...payload, jti: 'expired-jti' },
      secret,
      { expiresIn: -1 }
    );
    expect(verifyToken(expiredToken)).toBeNull();
  });

  it('each generated token has a unique jti', () => {
    const t1 = generateToken(payload);
    const t2 = generateToken(payload);
    const p1 = verifyToken(t1);
    const p2 = verifyToken(t2);
    expect(p1!.jti).not.toBe(p2!.jti);
  });
});

// ---------------------------------------------------------------------------
// Token extraction helpers
// ---------------------------------------------------------------------------

describe('extractTokenFromHeader', () => {
  it('extracts token from a valid Bearer header', () => {
    const token = extractTokenFromHeader('Bearer my-token-value');
    expect(token).toBe('my-token-value');
  });

  it('returns null for a missing header', () => {
    expect(extractTokenFromHeader(undefined)).toBeNull();
    expect(extractTokenFromHeader('')).toBeNull();
  });

  it('returns null for a non-Bearer scheme', () => {
    expect(extractTokenFromHeader('Basic dXNlcjpwYXNz')).toBeNull();
    expect(extractTokenFromHeader('Token abc123')).toBeNull();
  });

  it('returns null for "Bearer " with no token', () => {
    expect(extractTokenFromHeader('Bearer ')).toBeNull();
  });
});

describe('extractTokenFromCookie', () => {
  it('extracts auth_token from a cookie header', () => {
    const token = extractTokenFromCookie('auth_token=my-jwt-value; other=stuff');
    expect(token).toBe('my-jwt-value');
  });

  it('handles URL-encoded cookie values', () => {
    const encoded = encodeURIComponent('my.jwt.token');
    const token = extractTokenFromCookie(`auth_token=${encoded}`);
    expect(token).toBe('my.jwt.token');
  });

  it('returns null when auth_token cookie is absent', () => {
    expect(extractTokenFromCookie('session=abc; csrf=xyz')).toBeNull();
    expect(extractTokenFromCookie(null)).toBeNull();
    expect(extractTokenFromCookie(undefined)).toBeNull();
    expect(extractTokenFromCookie('')).toBeNull();
  });

  it('extracts auth_token when it is not the first cookie', () => {
    const token = extractTokenFromCookie('session=abc; auth_token=my-token; other=xyz');
    expect(token).toBe('my-token');
  });
});
