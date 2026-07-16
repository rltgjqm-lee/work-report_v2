// Workers 런타임은 UTC 기준이라, KST(UTC+9) 날짜/시각이 필요한 곳(근태 workDate,
// 재난문자 근무시간 매칭)에서 공통으로 쓴다.
export const getKstNow = (): { date: string; time: string; iso: string } => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const iso = kst.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), iso };
};
