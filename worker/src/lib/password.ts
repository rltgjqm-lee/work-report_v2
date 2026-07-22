// 관리자 비밀번호 해싱 — Workers 네이티브 crypto.subtle의 PBKDF2만 쓴다 (bcrypt/argon2는
// Node 전용 네이티브 모듈이라 Workers에서 못 씀). 저장 형식은 "iterations:saltHex:hashHex".
const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (hex: string): Uint8Array =>
  new Uint8Array(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

const derive = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    HASH_BITS,
  );
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}:${toHex(salt.buffer as ArrayBuffer)}:${toHex(hash)}`;
};

// 타이밍 공격 방지를 위해 길이가 같으면 XOR 누적으로 비교한다 (일찍 return하지 않음).
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [iterationsRaw, saltHex, hashHex] = stored.split(":");
  const iterations = Number(iterationsRaw);
  if (!iterations || !saltHex || !hashHex) return false;

  const salt = fromHex(saltHex);
  const hash = await derive(password, salt, iterations);
  return timingSafeEqual(toHex(hash), hashHex);
};
