import { useEffect, useState } from "react";

import { getLeaves, getLeaveStats } from "../../api/admin/programs";
import MonthPicker from "../../components/MonthPicker";
import StatusChip, { type StatusChipVariant } from "../../components/chip/StatusChip";
import { getLocalYearMonth } from "../../../utils/timeFormat";
import type { LeaveRow, LeaveStats } from "../../types";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  PAID: "유급",
  UNPAID: "무급",
};

const LEAVE_TYPE_VARIANT: Record<string, StatusChipVariant> = {
  PAID: "ok",
  UNPAID: "pending",
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

interface LeaveTabPanelProps {
  programId: number;
  participantIds: Set<number> | null;
}

/**
 * 관리자 페이지 > 근태 관리 페이지의 "휴가" 탭 내용입니다.
 *
 */
const LeaveTabPanel = ({ programId, participantIds }: LeaveTabPanelProps) => {
  const [month, setMonth] = useState(getLocalYearMonth());
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [stats, setStats] = useState<LeaveStats>(emptyStats);

  useEffect(() => {
    getLeaves(programId, month).then(setLeaves);
    getLeaveStats(programId, month.slice(0, 4)).then(setStats);
  }, [programId, month]);

  // 수요처 필터는 상위 페이지가 참여자 id 집합으로 내려준다 (null이면 전체).
  // 상단 통계는 사업단/연 단위 집계라 필터와 무관하게 그대로 둔다.
  const filteredLeaves = participantIds
    ? leaves.filter((row) => participantIds.has(row.leave.participantId))
    : leaves;

  // month는 "2026-07" 형식이라, slice(5, 7)로 "-" 뒤 월 부분("07")만 꺼내서
  // stats.monthly[].month("01"~"12")와 비교한다
  const monthStat = stats.monthly.find((row) => row.month === month.slice(5, 7));

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-3 mb-3">
        <div className="px-5 py-4 border border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">이달 휴가</div>
          <div className="text-sm font-bold">{monthStat?.totalLeaves ?? 0}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            유급 / 무급
          </div>
          <div className="text-sm font-bold">
            {monthStat?.paidLeaves ?? 0}건 / {monthStat?.unpaidLeaves ?? 0}건
          </div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            이달 휴가일수
          </div>
          <div className="text-sm font-bold">{monthStat?.totalDays ?? 0}일</div>
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
              {filteredLeaves.map((row) => (
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
                    <StatusChip variant={LEAVE_TYPE_VARIANT[row.leave.leaveType]}>
                      {LEAVE_TYPE_LABEL[row.leave.leaveType]}
                    </StatusChip>
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
              {filteredLeaves.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]">
                    해당 월에 휴가 기록이 없습니다.
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

export default LeaveTabPanel;
