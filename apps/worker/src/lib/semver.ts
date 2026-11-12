// OTA 번들 버전 비교용. "1.4.2" 형태의 단순 세미버 문자열만 다루므로 프리릴리즈/빌드
// 메타데이터 같은 전체 세미버 스펙은 지원하지 않는다.
export const compareVersions = (a: string, b: string): number => {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const length = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < length; i++) {
    const aPart = aParts[i] ?? 0;
    const bPart = bParts[i] ?? 0;
    if (aPart !== bPart) return aPart - bPart;
  }
  return 0;
};

export const isNewerVersion = (candidate: string, current: string): boolean =>
  compareVersions(candidate, current) > 0;
