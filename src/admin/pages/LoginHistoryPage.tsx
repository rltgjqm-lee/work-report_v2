import { useQuery } from "@tanstack/react-query";

import { loginHistoryQueryOptions } from "../api/admin/loginHistory";

// 서버는 SQLite CURRENT_TIMESTAMP(UTC, "YYYY-MM-DD HH:MM:SS" 형식)를 그대로 내려준다 —
// 화면에 뿌리기 전에 한국 시간(KST, UTC+9)으로 바꿔서 보여준다.
const formatKstDateTime = (utcTimestamp: string): string => {
  const date = new Date(`${utcTimestamp.replace(" ", "T")}Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
};

/**
 * 관리자 페이지 > 로그인 이력 페이지입니다. SUPER_ADMIN만 접근 가능합니다.
 *
 */
const LoginHistoryPage = () => {
  const { data: entries = [] } = useQuery(loginHistoryQueryOptions);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[21px] font-bold m-0">로그인 이력</h1>
        <p className="text-[13px] text-text-subtle mt-1.5">
          관리자 계정의 로그인 성공/실패 시도를 최근 200건까지 표시합니다.
        </p>
      </div>

      <div className="bg-white border border-admin-border-subtle rounded-[2px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[170px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  시각
                </th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  이메일
                </th>
                <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  이름
                </th>
                <th className="w-[130px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  IP
                </th>
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                  결과
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-admin-row-hover">
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                    {formatKstDateTime(entry.createdAt)}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    {entry.email}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    {entry.adminName ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    {entry.ipAddress ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                    <span
                      className={
                        entry.success ? "text-admin-success-text" : "text-admin-error-text"
                      }
                    >
                      {entry.success ? "성공" : "실패"}
                    </span>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-[13px] text-admin-text-placeholder"
                  >
                    로그인 이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LoginHistoryPage;
