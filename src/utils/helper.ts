// utils/phoneQuery.ts
export function phoneOrCondition(phone: string): string {
  // Normalize both formats: with +91 and without
  const withCode = phone.startsWith('+91') ? phone : `+91${phone}`;
  const withoutCode = phone.replace(/^\+91/, '');
  return `phone.eq.${withCode},phone.eq.${withoutCode}`;
}
