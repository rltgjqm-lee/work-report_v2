export type DisasterMessage = {
  id: string;
  region: string;
  message: string;
  sentAt: string;
};

// ⚠️ 아래 엔드포인트/파라미터/응답 필드명은 실제 행안부 긴급재난문자 API 문서를
// 확인하기 전까지의 임시 추정치입니다 (safetydata.go.kr 이용신청 후 발급되는
// 문서로 확정 필요). 실제 키/응답 샘플을 확인하면 이 파일 안의 URL과
// 응답 매핑(response.body[].SN/RCPTN_RGN_NM/MSG_CN/CRT_DT)만 고치면 됩니다.
const DISASTER_API_BASE_URL =
  "https://www.safetydata.go.kr/V2/api/DSSP-IF-00247";

type RawDisasterMessage = {
  SN?: string | number;
  RCPTN_RGN_NM?: string;
  MSG_CN?: string;
  CRT_DT?: string;
};

export const fetchRecentDisasterMessages = async (
  apiKey: string,
): Promise<DisasterMessage[]> => {
  const url = new URL(DISASTER_API_BASE_URL);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("returnType", "json");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`재난문자 API 호출 실패: ${res.status}`);
  }

  const data = (await res.json()) as { body?: RawDisasterMessage[] };

  return (data.body ?? [])
    .map((row) => ({
      id: String(row.SN ?? ""),
      region: row.RCPTN_RGN_NM ?? "",
      message: row.MSG_CN ?? "",
      sentAt: row.CRT_DT ?? "",
    }))
    .filter((m) => m.id);
};
