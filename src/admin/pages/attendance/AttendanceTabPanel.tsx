import { useEffect, useState } from "react";

import { getMonthlyAttendance } from "../../api/admin/programs";
import {
  correctAttendance,
  invalidateAttendance,
} from "../../api/admin/attendance";
import MonthPicker from "../../components/MonthPicker";
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
}

/**
 * 관리자 페이지 > 근태 관리 페이지의 "근태" 탭 내용입니다.
 *
 */
const AttendanceTabPanel = ({ programId }: AttendanceTabPanelProps) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [logs, setLogs] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState<AttendanceStats>(emptyStats);

  const [correctionTarget, setCorrectionTarget] =
    useState<AttendanceRow | null>(null);
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
      `'${row.participantName}' 님의 ${row.log.workDate} 근태 기록을 무효화합니다. 사유를 입력해주세요.`,
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
      <div className="flex items-center justify-end mb-3">
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-5 mb-5">
        <div className="px-5 py-4 border border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            총 건수
          </div>
          <div className="text-sm font-bold">{stats.total}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            정상
          </div>
          <div className="text-sm font-bold">{stats.normal}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            지각
          </div>
          <div className="text-sm font-bold">{stats.late}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            조퇴
          </div>
          <div className="text-sm font-bold">{stats.earlyLeave}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            총 근무시간
          </div>
          <div className="text-sm font-bold">{stats.totalHours}시간</div>
        </div>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse">
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
                <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  근무시간(분)
                </th>
                <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  상태
                </th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  비고
                </th>
                <th className="w-[150px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
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
                    {row.log.totalMinutes ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {STATUS_LABEL[row.log.status]}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
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
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]"
                  >
                    해당 월에 근태 기록이 없습니다.
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
              {correctionTarget.participantName} —{" "}
              {correctionTarget.log.workDate} 근태 수정
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
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  상태
                </label>
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
              <button
                className={btnGhostClass}
                onClick={() => setCorrectionTarget(null)}
              >
                취소
              </button>
              <button
                className={btnPrimaryClass}
                onClick={handleSaveCorrectionButtonClick}
              >
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
