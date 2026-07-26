// Workers 런타임은 UTC 기준이라, KST(UTC+9) 날짜/시각이 필요한 곳(근태 workDate,
// 재난문자 근무시간 매칭)에서 공통으로 쓴다.
// overrideTime("HH:MM")은 로컬 개발 중 출퇴근 시간 검증을 테스트하기 위한 것으로,
// 호출부(public.ts)에서 localhost 요청에서만 실제로 넘어온다.
export const getKstNow = (
  overrideTime?: string,
): { date: string; time: string; iso: string } => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const date = kst.toISOString().slice(0, 10);
  if (overrideTime) {
    return { date, time: overrideTime, iso: `${date}T${overrideTime}:00.000Z` };
  }
  const iso = kst.toISOString();
  return { date, time: iso.slice(11, 16), iso };
};
