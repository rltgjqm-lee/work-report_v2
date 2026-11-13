const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 서버가 동료(같은 수요처, 지금 근무 중)에게는 이미 웹푸시/FCM으로 알린다.
// TODO: 관리자 Web Push는 관리자 쪽 구독 테이블이 아직 없어서 별도로 붙여야 한다.
export const triggerSos = async (participantId: number): Promise<void> => {
  const res = await fetch(`${BASE_URL}/public/sos`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "SOS 전송에 실패했습니다.");
  }
};

// 홈 버튼과 플로팅 버튼 둘 다 "전송 실패해도 모달은 이미 닫힌 뒤"라 같은 방식으로 삼킨다.
export const sendSos = (participantId: number): void => {
  triggerSos(participantId).catch((error) => {
    console.error("SOS 전송 실패:", error);
  });
};
