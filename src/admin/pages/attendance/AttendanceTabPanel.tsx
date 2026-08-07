import { useEffect, useState } from "react";

import { getMonthlyAttendance } from "../../api/admin/programs";
import { correctAttendance, invalidateAttendance } from "../../api/admin/attendance";
import MonthPicker from "../../components/MonthPicker";
import FilterSelect from "../../components/FilterSelect";
import AttendanceLocationCell from "../../components/AttendanceLocationCell";
import StatusChip, { type StatusChipVariant } from "../../components/chip/StatusChip";
import { getLocalYearMonth } from "../../../utils/timeFormat";
import {
  btnGhostClass,
  btnPrimaryClass,
  inputClass,
  rowActionBtnClass,
  selectClass,
} from "../../uiClasses";
import type { AttendanceRow, AttendanceStats } from "../../types";

const STATUS_LABEL: Record<string, string> = {
  NORMAL: "정상",
  LATE: "지각",
  EARLY_LEAVE: "조퇴",
  INVALID: "무효화됨",
};

const STATUS_VARIANT: Record<string, StatusChipVariant> = {
  NORMAL: "ok",
  LATE: "warn",
  EARLY_LEAVE: "warn",
  INVALID: "bad",
};

interface CorrectionForm {
  clockIn: string;
  clockOut: string;
  status: "NORMAL" | "LATE" | "EARLY_LEAVE";
  reason: string;
}

const emptyStats: AttendanceStats = {
  total: 0,
  normal: 0,
  late: 0,
  earlyLeave: 0,
  totalHours: 0,
};

interface AttendanceTabPanelProps {
  programId: number;
  participantIds: Set<number> | null;
}

/**
 * 관리자 페이지 > 근무 관리 페이지의 "근무" 탭 내용입니다.
 *
 */
const AttendanceTabPanel = ({ programId, participantIds }: AttendanceTabPanelProps) => {
  const [month, setMonth] = useState(getLocalYearMonth());
  const [dayFilter, setDayFilter] = useState("all");
  const [logs, setLogs] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState<AttendanceStats>(emptyStats);

  // 달을 바꾸면 예전 달 날짜가 남아있지 않도록 일별 필터를 초기화한다.
  // 렌더링 도중 상태를 조정해서 effect의 연쇄 렌더링을 피한다.
  const [prevMonth, setPrevMonth] = useState(month);
  if (month !== prevMonth) {
    setPrevMonth(month);
    setDayFilter("all");
  }

  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRow | null>(null);
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>({
    clockIn: "",
    clockOut: "",
    status: "NORMAL",
    reason: "",
  });

  const refresh = () => {
    getMonthlyAttendance(programId, month).then((result) => {
      setLogs(result.logs);
      setStats(result.stats);
    });
  };

  useEffect(refresh, [programId, month]);

  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

  // 수요처 필터는 상위 페이지가 참여자 id 집합으로 내려준다 (null이면 전체)
  const scopedLogs = participantIds
    ? logs.filter((row) => participantIds.has(row.log.participantId))
    : logs;

  const filteredLogs =
    dayFilter === "all"
      ? scopedLogs
      : scopedLogs.filter((row) => row.log.workDate === `${month}-${dayFilter.padStart(2, "0")}`);

  // 서버가 준 stats는 사업단 전체 기준이라, 수요처나 날짜로 걸렀으면 직접 다시 센다
  const dayStatsTotals =
    dayFilter === "all" && !participantIds
      ? null
      : filteredLogs.reduce(
          (acc, row) => ({
            total: acc.total + 1,
            normal: acc.normal + (row.log.status === "NORMAL" ? 1 : 0),
            late: acc.late + (row.log.status === "LATE" ? 1 : 0),
            earlyLeave: acc.earlyLeave + (row.log.status === "EARLY_LEAVE" ? 1 : 0),
            totalMinutes:
              acc.totalMinutes + (row.log.status !== "INVALID" ? (row.log.totalMinutes ?? 0) : 0),
          }),
          { total: 0, normal: 0, late: 0, earlyLeave: 0, totalMinutes: 0 },
        );
  const displayStats: AttendanceStats = dayStatsTotals
    ? {
        ...dayStatsTotals,
        totalHours: Math.round((dayStatsTotals.totalMinutes / 60) * 10) / 10,
      }
    : stats;

  const handleCorrectButtonClick = (row: AttendanceRow) => {
    setCorrectionTarget(row);
    setCorrectionForm({
      clockIn: row.log.clockIn?.slice(11, 16) ?? "",
      clockOut: row.log.clockOut?.slice(11, 16) ?? "",
      status: row.log.status === "INVALID" ? "NORMAL" : row.log.status,
      reason: "",
    });
  };

  const handleSaveCorrectionButtonClick = async () => {
    if (!correctionTarget) return;
    if (!correctionForm.reason) {
      alert("수정 사유를 입력해주세요.");

      return;
    }
    try {
      await correctAttendance(correctionTarget.log.id, {
        clockIn: correctionForm.clockIn || undefined,
        clockOut: correctionForm.clockOut || undefined,
        status: correctionForm.status,
        reason: correctionForm.reason,
      });
      setCorrectionTarget(null);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "수정에 실패했습니다.");
    }
  };

  const handleInvalidateButtonClick = async (row: AttendanceRow) => {
    const reason = prompt(
      `'${row.participantName}' 님의 ${row.log.workDate} 근무 기록을 무효화합니다. 사유를 입력해주세요.`,
    );
    if (reason === null) return;

    try {
      await invalidateAttendance(row.log.id, reason || undefined);
      refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "무효화에 실패했습니다.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-end gap-2.5 mb-3">
        <MonthPicker value={month} onChange={setMonth} />
        <FilterSelect
          value={dayFilter}
          onChange={setDayFilter}
          options={[
            { value: "all", label: "전체 일자" },
            ...Array.from({ length: daysInMonth }, (_, i) => {
              const day = String(i + 1);
              return { value: day, label: `${day}일` };
            }),
          ]}
        />
      </div>

      <div className="grid grid-cols-5 mb-5">
        <div className="px-5 py-4 border border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">총 건수</div>
          <div className="text-sm font-bold">{displayStats.total}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">정상</div>
          <div className="text-sm font-bold">{displayStats.normal}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">지각</div>
          <div className="text-sm font-bold">{displayStats.late}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">조퇴</div>
          <div className="text-sm font-bold">{displayStats.earlyLeave}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            총 근무시간
          </div>
          <div className="text-sm font-bold">{displayStats.totalHours}시간</div>
        </div>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1270px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  근무일
                </th>
                <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  참여자명
                </th>
                <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  조
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
                <th className="w-[260px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  비고
                </th>
                <th className="w-[150px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((row) => (
                <tr
                  key={row.log.id}
                  className={
                    row.log.status === "INVALID"
                      ? "opacity-50 hover:bg-[#f8fafc]"
                      : "hover:bg-[#f8fafc]"
                  }
                >
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {row.log.workDate}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {row.participantName}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {row.groupName ?? "-"}
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
                    <StatusChip variant={STATUS_VARIANT[row.log.status]}>
                      {STATUS_LABEL[row.log.status]}
                    </StatusChip>
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-pre-wrap break-words">
                    {row.log.note ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {row.log.status !== "INVALID" && (
                      <>
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleCorrectButtonClick(row)}
                        >
                          수정
                        </button>
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleInvalidateButtonClick(row)}
                        >
                          무효화
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]">
                    {dayFilter === "all"
                      ? "해당 월에 근무 기록이 없습니다."
                      : "해당 일자에 근무 기록이 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {correctionTarget && (
        <div className="fixed inset-0 bg-[rgba(15,23,32,0.45)] z-[2000] flex items-center justify-center">
          <div className="bg-white rounded-[8px] shadow-xl w-[380px] p-5">
            <div className="text-[14px] font-bold mb-4">
              {correctionTarget.participantName} — {correctionTarget.log.workDate} 근무 수정
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  출근시간
                </label>
                <input
                  type="time"
                  className={inputClass}
                  value={correctionForm.clockIn}
                  onChange={(event) =>
                    setCorrectionForm((f) => ({
                      ...f,
                      clockIn: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  퇴근시간
                </label>
                <input
                  type="time"
                  className={inputClass}
                  value={correctionForm.clockOut}
                  onChange={(event) =>
                    setCorrectionForm((f) => ({
                      ...f,
                      clockOut: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">상태</label>
                <select
                  className={selectClass}
                  value={correctionForm.status}
                  onChange={(event) =>
                    setCorrectionForm((f) => ({
                      ...f,
                      status: event.target.value as CorrectionForm["status"],
                    }))
                  }
                >
                  <option value="NORMAL">정상</option>
                  <option value="LATE">지각</option>
                  <option value="EARLY_LEAVE">조퇴</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  수정 사유 (필수)
                </label>
                <input
                  className={inputClass}
                  value={correctionForm.reason}
                  onChange={(event) =>
                    setCorrectionForm((f) => ({
                      ...f,
                      reason: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className={btnGhostClass} onClick={() => setCorrectionTarget(null)}>
                취소
              </button>
              <button className={btnPrimaryClass} onClick={handleSaveCorrectionButtonClick}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTabPanel;
