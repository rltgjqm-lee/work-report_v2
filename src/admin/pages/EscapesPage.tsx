import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getEscapes, getProgram } from "../api/admin/programs";
import { resolveEscape } from "../api/admin/escapes";
import type { EscapeRow, EscapeStatus } from "../types";

const EscapesPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const programId = Number(id);

  const [programName, setProgramName] = useState("");
  const [status, setStatus] = useState<EscapeStatus>("OPEN");
  const [rows, setRows] = useState<EscapeRow[]>([]);

  useEffect(() => {
    getProgram(programId).then((program) => setProgramName(program.name));
  }, [programId]);

  const refresh = () => {
    getEscapes(programId, status).then(setRows);
  };

  useEffect(refresh, [programId, status]);

  const handleResolve = async (escapeId: number, participantName: string) => {
    const memo = prompt(`'${participantName}' 님 이탈 확인 처리 — 메모(선택)`);
    if (memo === null) return;

    try {
      await resolveEscape(escapeId, memo || undefined);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-xs text-[#6b7280] mb-1.5">
            사업단 관리 /{" "}
            <a
              onClick={() => navigate(`/admin/programs/${programId}`)}
              className="cursor-pointer text-[#1e3a5f] hover:text-[#132a45]"
            >
              {programName || "사업단 상세"}
            </a>{" "}
            / 이탈 현황
          </div>
          <h1 className="text-[21px] font-bold m-0">이탈 현황</h1>
        </div>
        <select
          className="border border-[#d7dbe1] px-3 py-2 text-[13px] rounded-[2px] bg-white"
          value={status}
          onChange={(event) => setStatus(event.target.value as EscapeStatus)}
        >
          <option value="OPEN">확인 필요</option>
          <option value="RESOLVED">처리 완료</option>
        </select>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[150px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  감지시각
                </th>
                <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  참여자명
                </th>
                <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  조
                </th>
                <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  수요처
                </th>
                <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  이탈거리
                </th>
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  단계
                </th>
                <th className="w-[140px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.escape.id}
                  className={
                    row.escape.alertCount >= 3
                      ? "bg-[#fdecea] hover:bg-[#fbdedb]"
                      : "hover:bg-[#f8fafc]"
                  }
                >
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {row.escape.detectedAt}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {row.participantName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {row.groupName ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {row.demandSiteName ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {row.escape.distanceKm.toFixed(2)}km
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] font-semibold">
                    {row.escape.alertCount >= 3
                      ? "3단계(위급)"
                      : row.escape.alertCount === 2
                        ? "2단계(주의)"
                        : "1단계(경고)"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {row.escape.status === "OPEN" ? (
                      <button
                        className="border border-[#d7dbe1] px-2.5 py-1 text-xs rounded-[2px] bg-white hover:bg-[#f3f4f6]"
                        onClick={() =>
                          handleResolve(row.escape.id, row.participantName)
                        }
                      >
                        확인 처리
                      </button>
                    ) : (
                      <span className="text-xs text-[#6b7280]">
                        {row.escape.memo || "처리완료"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]"
                  >
                    {status === "OPEN"
                      ? "확인이 필요한 이탈이 없습니다."
                      : "처리된 이탈 이력이 없습니다."}
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

export default EscapesPage;
