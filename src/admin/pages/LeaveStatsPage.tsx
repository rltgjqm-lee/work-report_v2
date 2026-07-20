import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getLeaves,
  getLeaveStats,
  getProgram,
  listPrograms,
} from "../api/admin/programs";
import { inputClass, selectClass } from "../uiClasses";
import type { LeaveRow, LeaveStats, Program } from "../types";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  PAID: "유급",
  UNPAID: "무급",
};

const emptyStats: LeaveStats = {
  monthly: [],
  annual: {
    participants: 0,
    totalAnnual: 0,
    usedAnnual: 0,
    remainingAnnual: 0,
  },
};

/**
 * 관리자 페이지 > 휴가 현황 페이지입니다.
 *
 */
const LeaveStatsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const preselectedProgramId = id ? Number(id) : null;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(id ?? "");
  const [programName, setProgramName] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [stats, setStats] = useState<LeaveStats>(emptyStats);

  // 사이드바로 바로 들어온 경우(사업단 id 없음) 고를 수 있게 전체 사업단 목록을 가져온다
  useEffect(() => {
    if (!preselectedProgramId) listPrograms().then(setPrograms);
  }, [preselectedProgramId]);

  useEffect(() => {
    if (preselectedProgramId) {
      getProgram(preselectedProgramId).then((program) =>
        setProgramName(program.name),
      );
    }
  }, [preselectedProgramId]);

  const programId = preselectedProgramId ?? Number(selectedProgramId);

  useEffect(() => {
    if (!programId) return;

    getLeaves(programId, month).then(setLeaves);
    getLeaveStats(programId, month.slice(0, 4)).then(setStats);
  }, [programId, month]);

  // month는 "2026-07" 형식이라, slice(5, 7)로 "-" 뒤 월 부분("07")만 꺼내서
  // stats.monthly[].month("01"~"12")와 비교한다
  const monthStat = stats.monthly.find(
    (row) => row.month === month.slice(5, 7),
  );

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          {preselectedProgramId ? (
            <div className="text-xs text-[#6b7280] mb-1.5">
              사업단 관리 /{" "}
              <a
                onClick={() =>
                  navigate(`/admin/programs/${preselectedProgramId}`)
                }
                className="cursor-pointer text-[#1e3a5f] hover:text-[#132a45]"
              >
                {programName || "사업단 상세"}
              </a>{" "}
              / 휴가 현황
            </div>
          ) : null}
          <h1 className="text-[21px] font-bold m-0">휴가 현황</h1>
        </div>
        <div className="flex items-center gap-2.5">
          {!preselectedProgramId && (
            <select
              className={selectClass}
              value={selectedProgramId}
              onChange={(event) => setSelectedProgramId(event.target.value)}
            >
              <option value="">사업단을 선택하세요</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="month"
            className={inputClass}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>

      {!programId ? (
        <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-10 text-center text-[13px] text-[#9aa1ab]">
          조회할 사업단을 선택해주세요.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 mb-3">
            <div className="px-5 py-4 border border-[#e2e5eb]">
              <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
                이달 휴가
              </div>
              <div className="text-sm font-bold">
                {monthStat?.totalLeaves ?? 0}건
              </div>
            </div>
            <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
              <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
                유급 / 무급
              </div>
              <div className="text-sm font-bold">
                {monthStat?.paidLeaves ?? 0}건 / {monthStat?.unpaidLeaves ?? 0}
                건
              </div>
            </div>
            <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
              <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
                이달 휴가일수
              </div>
              <div className="text-sm font-bold">
                {monthStat?.totalDays ?? 0}일
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      참여자명
                    </th>
                    <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      조
                    </th>
                    <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      시작일
                    </th>
                    <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      종료일
                    </th>
                    <th className="w-[70px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      일수
                    </th>
                    <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      유형
                    </th>
                    <th className="w-[200px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      사유
                    </th>
                    <th className="text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                      연차 현황
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((row) => (
                    <tr key={row.leave.id} className="hover:bg-[#f8fafc]">
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        {row.participantName}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        {row.groupName ?? "-"}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                        {row.leave.leaveStart}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                        {row.leave.leaveEnd}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        {row.leave.leaveDays}일
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                        {LEAVE_TYPE_LABEL[row.leave.leaveType]}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                        {row.leave.reason ?? "-"}
                      </td>
                      <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                        {row.annualTotalDays === null
                          ? "-"
                          : `${row.annualTotalDays}일 중 ${row.annualUsedDays}일 사용 (${row.annualRemainingDays}일 남음)`}
                      </td>
                    </tr>
                  ))}
                  {leaves.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]"
                      >
                        해당 월에 휴가 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LeaveStatsPage;
