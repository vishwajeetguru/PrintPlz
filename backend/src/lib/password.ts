import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateReadablePassword(length = 10): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$';
  const all = upper + lower + digits + symbols;
  let out = '';
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  out += rand(upper) + rand(lower) + rand(digits) + rand(symbols);
  for (let i = out.length; i < length; i++) out += rand(all);
  return out.split('').sort(() => Math.random() - 0.5).join('');
}
