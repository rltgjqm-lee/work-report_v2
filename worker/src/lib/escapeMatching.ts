// 근무 기록 한 건에 그날 이탈이 있었는지 확인하는 규칙
// — 같은 참여자가 같은 날 이탈이 여러 건일때,
// 1. 미처리 건 부터 보여준다.
// 2. 전부 처리됐으면 가장 최근 처리 건을 보여준다.
// 사업단 근무 목록(programs.ts)과 참여자 개인 근무 목록(participants.ts) 둘 다 이 규칙을 쓴다.

type EscapeCandidate = {
  participantId: number;
  detectedAt: string;
  status: "OPEN" | "RESOLVED";
  memo: string | null;
};

export const matchEscapeToWorkDate = <T extends EscapeCandidate>(
  escapes: T[],
  participantId: number,
  workDate: string,
): T | null => {
  const sameDayEscapes = escapes.filter(
    (escape) =>
      escape.participantId === participantId && escape.detectedAt.slice(0, 10) === workDate,
  );
  if (sameDayEscapes.length === 0) return null;

  const openEscape = sameDayEscapes.find((escape) => escape.status === "OPEN");
  if (openEscape) return openEscape;

  return sameDayEscapes.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0];
};
