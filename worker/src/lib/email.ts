// Resend REST API로 트랜잭션 이메일을 보낸다. Cloudflare Workers는 SMTP를 직접 못 띄우므로
// 외부 이메일 API를 fetch로 호출하는 방식을 쓴다. 실패해도 예외를 던지지 않고 결과만
// 돌려준다 — 호출부(비밀번호 찾기)가 "메일 발송 실패"를 "계정 없음"과 구분 없이 항상
// 같은 성공 응답으로 감싸야 계정 존재 여부가 새어나가지 않는다.
export const sendEmail = async (
  apiKey: string,
  options: { from: string; to: string; subject: string; html: string },
): Promise<{ ok: boolean }> => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      console.error("Resend 이메일 발송 실패:", response.status, await response.text());
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("Resend 이메일 발송 중 오류:", error);
    return { ok: false };
  }
};
