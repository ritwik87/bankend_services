import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Stateless "are you human" check: a small arithmetic question whose answer is bound into an
// HMAC-signed, expiring token. Nothing is stored in the database.
//
// Bot-level protection only — it does NOT prove who the user is. Never use it to start a login
// session or to grant access to an existing account.

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type HumanCheckProof = { token: string; answer: string };

export function getHumanCheckSecret(): string {
  const secret =
    process.env.HUMAN_CHECK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('HUMAN_CHECK_SECRET is not configured');
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getHumanCheckSecret()).update(payload).digest('hex');
}

export function createHumanChallenge(): { question: string; token: string } {
  const a = 2 + Math.floor(Math.random() * 18);
  const b = 2 + Math.floor(Math.random() * 18);
  const exp = Date.now() + CHALLENGE_TTL_MS;
  const nonce = randomBytes(8).toString('hex');
  const sig = sign(`${exp}.${nonce}.${a + b}`);
  return { question: `What is ${a} + ${b}?`, token: `${exp}.${nonce}.${sig}` };
}

export function verifyHumanChallenge(
  proof?: Partial<HumanCheckProof> | null
): boolean {
  try {
    const answer = String(proof?.answer ?? '').trim();
    const [exp, nonce, sig] = String(proof?.token ?? '').split('.');
    if (!/^\d{1,3}$/.test(answer) || !exp || !nonce || !sig) return false;
    if (!(Number(exp) > Date.now())) return false;

    const expected = Buffer.from(sign(`${exp}.${nonce}.${Number(answer)}`));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
