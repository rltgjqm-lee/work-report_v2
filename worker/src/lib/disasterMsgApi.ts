export type DisasterMessage = {
  id: string;
  region: string;
  message: string;
  alertType: string;
  sentAt: string;
};

export type DisasterMessagePage = {
  messages: DisasterMessage[];
  totalCount: number;
};

// 실제 API로 확인된 값 (2026-07-19) — 엔드포인트/파라미터명/응답 필드명 전부 확정됨.
// ⚠️ numOfRows는 몇을 요청하든 서버가 최대 1000으로 강제 고정한다.
// ⚠️ crtDt(YYYYMMDD)는 "그날 하루"가 아니라 "그 날짜 이후 전체 누적"을 오름차순으로 반환한다.
//    그래서 매번 오늘 날짜로 crtDt를 넣어야 그날 치만(대략 100~350건 수준) 받게 된다.
const DISASTER_API_BASE_URL =
  "https://www.safetydata.go.kr/V2/api/DSSP-IF-00247";
const MAX_ROWS_PER_PAGE = 1000;

type RawDisasterMessage = {
  SN?: string | number;
  RCPTN_RGN_NM?: string;
  MSG_CN?: string;
  DST_SE_NM?: string;
  CRT_DT?: string;
};

// crtDt(YYYYMMDD, KST 기준 오늘)의 pageNo번째 페이지 하나만 가져온다.
// 여러 페이지 이어받기(호출 예산 체크 포함)는 호출하는 쪽(checkDisasterAlerts.ts)의 책임이다 —
// 여기서는 fetch 1번 = API 호출 1번이라는 관계를 명확히 유지한다.
export const fetchDisasterMessagesPage = async (
  apiKey: string,
  crtDt: string,
  pageNo: number,
): Promise<DisasterMessagePage> => {
  const url = new URL(DISASTER_API_BASE_URL);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("returnType", "json");
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(MAX_ROWS_PER_PAGE));
  url.searchParams.set("crtDt", crtDt);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`재난문자 API 호출 실패: ${res.status}`);
  }

  const data = (await res.json()) as {
    totalCount?: number;
    body?: RawDisasterMessage[];
  };

  const messages = (data.body ?? [])
    .map((row) => ({
      id: String(row.SN ?? ""),
      region: row.RCPTN_RGN_NM ?? "",
      message: row.MSG_CN ?? "",
      alertType: row.DST_SE_NM ?? "기타",
      sentAt: row.CRT_DT ?? "",
    }))
    .filter((m) => m.id);

  return { messages, totalCount: data.totalCount ?? messages.length };
};
