import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  participantAnnualLeaveQueryOptions,
  participantAttendanceQueryOptions,
  participantLeavesQueryOptions,
  participantQueryOptions,
} from "../../api/admin/participants";
import MonthPicker from "../../components/MonthPicker";
import AttendanceLocationCell from "../../components/AttendanceLocationCell";
import { btnPrimaryClass } from "../../uiClasses";
import { getLocalYearMonth } from "../../../utils/timeFormat";
import type {
  AnnualLeave,
  AttendanceStats,
  ParticipantAttendanceRow,
  ParticipantLeave,
} from "../../types";
import ParticipantPayrollSettingsModal from "./ParticipantPayrollSettingsModal";

const STATUS_LABEL: Record<string, string> = {
  NORMAL: "정상",
  LATE: "지각",
  EARLY_LEAVE: "조퇴",
};

const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "활동중",
  ON_LEAVE: "휴무중",
  DROPPED: "참여종료",
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  PAID: "유급",
  UNPAID: "무급",
};

const emptyStats: AttendanceStats = {
  total: 0,
  normal: 0,
  late: 0,
  earlyLeave: 0,
  totalHours: 0,
};

/**
 * 관리자 페이지 > 참여자 상세 페이지입니다. 개인의 근태 이력과 휴가 현황을 보여줍니다.
 *
 */
const ParticipantDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const participantId = Number(id);

  const [month, setMonth] = useState(getLocalYearMonth());
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);

  const { data: participant } = useQuery(participantQueryOptions(participantId));
  const { data: leaves = [] } = useQuery(participantLeavesQueryOptions(participantId));
  const { data: annualLeave } = useQuery(
    participantAnnualLeaveQueryOptions(participantId, new Date().getFullYear().toString()),
  );
  const { data: attendance } = useQuery(participantAttendanceQueryOptions(participantId, month));

  const attendanceLogs = attendance?.logs ?? [];
  const attendanceStats = attendance?.stats ?? emptyStats;

  if (!participant) {
    return (
      <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-10 text-center text-[13px] text-[#9aa1ab]">
        불러오는 중...
      </div>
    );
  }
  const participantSummary = `${participant.organizationName} · ${participant.programName}${
    participant.groupName ? ` · ${participant.groupName}` : ""
  } · ${PARTICIPANT_STATUS_LABEL[participant.status]}`;

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-xs text-[#6b7280] mb-1.5">
            <a
              onClick={() => navigate("/admin/participants")}
              className="cursor-pointer text-[#1e3a5f] hover:text-[#132a45]"
            >
              참여자 관리
            </a>{" "}
            / 참여자 상세
          </div>
          <h1 className="text-[21px] font-bold m-0">{participant.name}</h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5">{participantSummary}</p>
        </div>
      </div>

      {/* 급여 관련 설정 — 교육비/치매검진비는 항상, 4대보험/주휴수당은 역량활동만 모달에서 노출 */}
      <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-4 mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-bold">급여 관련 설정</span>
          <button className={btnPrimaryClass} onClick={() => setPayrollModalOpen(true)}>
            설정 변경
          </button>
        </div>
        <p className="text-xs text-[#9aa1ab] m-0">
          교육비·치매검진비·4대보험·주휴수당의 지급 여부를 관리합니다.
        </p>
      </div>

      {/* 근태 이력 */}
      <AttendanceHistorySection
        month={month}
        onMonthChange={setMonth}
        stats={attendanceStats}
        logs={attendanceLogs}
      />

      {/* 휴가 이력 */}
      <LeaveHistorySection annualLeave={annualLeave} leaves={leaves} />

      {/* 급여 설정 모달 */}
      {payrollModalOpen && (
        <ParticipantPayrollSettingsModal
          participant={participant}
          onClose={() => setPayrollModalOpen(false)}
        />
      )}
    </div>
  );
};

interface AttendanceHistorySectionProps {
  month: string;
  onMonthChange: (month: string) => void;
  stats: AttendanceStats;
  logs: ParticipantAttendanceRow[];
}

const AttendanceHistorySection = ({
  month,
  onMonthChange,
  stats,
  logs,
}: AttendanceHistorySectionProps) => (
  <>
    <div className="flex items-center justify-between mb-3 gap-3">
      <span className="text-sm font-bold whitespace-nowrap">근태 이력</span>
      <MonthPicker value={month} onChange={onMonthChange} />
    </div>

    <div className="grid grid-cols-4 mb-5">
      <div className="px-5 py-4 border border-[#e2e5eb]">
        <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">정상</div>
        <div className="text-sm font-bold">{stats.normal}건</div>
      </div>
      <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
        <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">지각</div>
        <div className="text-sm font-bold">{stats.late}건</div>
      </div>
      <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
        <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">조퇴</div>
        <div className="text-sm font-bold">{stats.earlyLeave}건</div>
      </div>
      <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
        <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">총 근무시간</div>
        <div className="text-sm font-bold">{stats.totalHours}시간</div>
      </div>
    </div>

    <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[910px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                근무일
              </th>
              <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                출근
              </th>
              <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                퇴근
              </th>
              <th className="w-[150px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                위치
              </th>
              <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                근무시간(분)
              </th>
              <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                상태
              </th>
              <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                서명
              </th>
              <th className="text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <tr key={row.log.id} className="hover:bg-[#f8fafc]">
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                  {row.log.workDate}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {row.log.clockIn?.slice(11, 16) ?? "-"}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {row.log.clockOut?.slice(11, 16) ?? "-"}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  <AttendanceLocationCell log={row.log} />
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {row.log.totalMinutes ?? "-"}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {STATUS_LABEL[row.log.status]}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {row.log.signatureKey ? "✓" : "-"}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-pre-wrap break-words">
                  {row.log.note ?? "-"}
                </td>
              </tr>
            ))}

            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]">
                  해당 월에 근태 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </>
);

interface LeaveHistorySectionProps {
  annualLeave: AnnualLeave | undefined;
  leaves: ParticipantLeave[];
}

const LeaveHistorySection = ({ annualLeave, leaves }: LeaveHistorySectionProps) => (
  <>
    <div className="mb-3">
      <span className="text-sm font-bold">휴가 이력</span>
    </div>

    <div className="grid grid-cols-3 mb-5">
      <div className="px-5 py-4 border border-[#e2e5eb]">
        <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
          연차 총 부여일
        </div>
        <div className="text-sm font-bold">{annualLeave?.totalDays ?? 0}일</div>
      </div>
      <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
        <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">사용</div>
        <div className="text-sm font-bold">{annualLeave?.usedDays ?? 0}일</div>
      </div>
      <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
        <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">잔여</div>
        <div className="text-sm font-bold">{annualLeave?.remainingDays ?? 0}일</div>
      </div>
    </div>

    <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                시작일
              </th>
              <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                종료일
              </th>
              <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                구분
              </th>
              <th className="w-[70px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                일수
              </th>
              <th className="text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                사유
              </th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id} className="hover:bg-[#f8fafc]">
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                  {leave.leaveStart}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                  {leave.leaveEnd}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {LEAVE_TYPE_LABEL[leave.leaveType]}
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                  {leave.leaveDays}일
                </td>
                <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                  {leave.reason ?? "-"}
                </td>
              </tr>
            ))}

            {leaves.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]">
                  휴가 이력이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </>
);

export default ParticipantDetailPage;
