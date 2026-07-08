import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "pp_session";
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    throw new Error(
      "APP_PASSWORD is not set. Required whenever this app is deployed anywhere other than localhost (Decision #9)."
    );
  }
  // Derive a fixed-length key from the password itself. This is a single-user,
  // low-stakes gate (Decision #9 explicitly scopes this as "not enterprise
  // auth") — not a substitute for real auth if this ever becomes multi-user.
  return new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export function checkPassword(candidate: string): boolean {
  const real = process.env.APP_PASSWORD;
  if (!real) return false;
  return candidate === real;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;
