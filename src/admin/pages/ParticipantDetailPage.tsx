import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getAnnualLeave,
  getParticipant,
  getParticipantAttendance,
  getParticipantLeaves,
  updateParticipant,
} from "../api/admin/participants";
import MonthPicker from "../components/MonthPicker";
import FormField from "../components/FormField";
import FilterSelect from "../components/FilterSelect";
import { btnPrimaryClass, inputClass } from "../uiClasses";
import type {
  AnnualLeave,
  AttendanceStats,
  ParticipantAttendanceRow,
  ParticipantDetail,
  ParticipantLeave,
} from "../types";

const FEE_TYPE_OPTIONS = [
  { value: "add", label: "가산" },
  { value: "deduct", label: "차감" },
  { value: "none", label: "없음" },
];

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

  const [participant, setParticipant] = useState<ParticipantDetail | null>(
    null,
  );
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceLogs, setAttendanceLogs] = useState<
    ParticipantAttendanceRow[]
  >([]);
  const [attendanceStats, setAttendanceStats] =
    useState<AttendanceStats>(emptyStats);
  const [leaves, setLeaves] = useState<ParticipantLeave[]>([]);
  const [annualLeave, setAnnualLeave] = useState<AnnualLeave | null>(null);

  const [settingsForm, setSettingsForm] = useState({
    educationAmount: "0",
    educationType: "none" as "add" | "deduct" | "none",
    dementiaAmount: "0",
    dementiaType: "none" as "add" | "deduct" | "none",
    socialInsuranceEnrolled: false,
    weeklyHolidayHours: "0",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    getParticipant(participantId).then((result) => {
      setParticipant(result);
      setSettingsForm({
        educationAmount: String(result.educationAmount),
        educationType: result.educationType,
        dementiaAmount: String(result.dementiaAmount),
        dementiaType: result.dementiaType,
        socialInsuranceEnrolled: result.socialInsuranceEnrolled,
        weeklyHolidayHours: String(result.weeklyHolidayHours),
      });
    });
    getParticipantLeaves(participantId).then(setLeaves);
    getAnnualLeave(participantId, new Date().getFullYear().toString()).then(
      setAnnualLeave,
    );
  }, [participantId]);

  const isCompetencyProgram = participant?.programType === "역량 활동";

  const handleSaveSettingsButtonClick = async () => {
    setSavingSettings(true);
    try {
      const updated = await updateParticipant(participantId, {
        educationAmount: Number(settingsForm.educationAmount),
        educationType: settingsForm.educationType,
        dementiaAmount: Number(settingsForm.dementiaAmount),
        dementiaType: settingsForm.dementiaType,
        ...(isCompetencyProgram
          ? {
              socialInsuranceEnrolled: settingsForm.socialInsuranceEnrolled,
              weeklyHolidayHours: Number(settingsForm.weeklyHolidayHours),
            }
          : {}),
      });
      setParticipant((prev) => (prev ? { ...prev, ...updated } : prev));
      alert("저장했습니다.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    getParticipantAttendance(participantId, month).then((result) => {
      setAttendanceLogs(result.logs);
      setAttendanceStats(result.stats);
    });
  }, [participantId, month]);

  if (!participant) {
    return (
      <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-10 text-center text-[13px] text-[#9aa1ab]">
        불러오는 중...
      </div>
    );
  }

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
          <p className="text-[13px] text-[#6b7280] mt-1.5">
            {participant.organizationName} · {participant.programName}
            {participant.groupName ? ` · ${participant.groupName}` : ""} ·{" "}
            {PARTICIPANT_STATUS_LABEL[participant.status]}
          </p>
        </div>
      </div>

      {/* 급여 관련 설정 — 교육비/치매검진비는 항상, 4대보험 가입여부/주휴시간은 역량활동만 */}
      <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
        <div className="px-5 py-4 border-b border-[#eceef1]">
          <span className="text-sm font-bold">급여 관련 설정</span>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="교육비(원)">
                <input
                  type="number"
                  className={inputClass}
                  value={settingsForm.educationAmount}
                  onChange={(event) =>
                    setSettingsForm((f) => ({
                      ...f,
                      educationAmount: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="교육비 처리">
                <FilterSelect
                  className="w-full"
                  value={settingsForm.educationType}
                  onChange={(value) =>
                    setSettingsForm((f) => ({
                      ...f,
                      educationType: value as "add" | "deduct" | "none",
                    }))
                  }
                  options={FEE_TYPE_OPTIONS}
                />
              </FormField>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="치매 검진비(원)">
                <input
                  type="number"
                  className={inputClass}
                  value={settingsForm.dementiaAmount}
                  onChange={(event) =>
                    setSettingsForm((f) => ({
                      ...f,
                      dementiaAmount: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="치매검진비 처리">
                <FilterSelect
                  className="w-full"
                  value={settingsForm.dementiaType}
                  onChange={(value) =>
                    setSettingsForm((f) => ({
                      ...f,
                      dementiaType: value as "add" | "deduct" | "none",
                    }))
                  }
                  options={FEE_TYPE_OPTIONS}
                />
              </FormField>
            </div>
          </div>

          {isCompetencyProgram && (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <FormField label="주휴시간(월, 시간)">
                  <input
                    type="number"
                    className={inputClass}
                    value={settingsForm.weeklyHolidayHours}
                    onChange={(event) =>
                      setSettingsForm((f) => ({
                        ...f,
                        weeklyHolidayHours: event.target.value,
                      }))
                    }
                  />
                </FormField>
              </div>
              <div className="flex-1 pb-2.5">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={settingsForm.socialInsuranceEnrolled}
                    onChange={(event) =>
                      setSettingsForm((f) => ({
                        ...f,
                        socialInsuranceEnrolled: event.target.checked,
                      }))
                    }
                  />
                  4대보험 가입
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              className={btnPrimaryClass}
              disabled={savingSettings}
              onClick={handleSaveSettingsButtonClick}
            >
              {savingSettings ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>

      {/* 연차 현황 */}
      <div className="grid grid-cols-3 mb-5">
        <div className="px-5 py-4 border border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            연차 총 부여일
          </div>
          <div className="text-sm font-bold">
            {annualLeave?.totalDays ?? 0}일
          </div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            사용
          </div>
          <div className="text-sm font-bold">
            {annualLeave?.usedDays ?? 0}일
          </div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            잔여
          </div>
          <div className="text-sm font-bold">
            {annualLeave?.remainingDays ?? 0}일
          </div>
        </div>
      </div>

      {/* 근태 이력 */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <span className="text-sm font-bold whitespace-nowrap">근태 이력</span>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-4 mb-5">
        <div className="px-5 py-4 border border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            정상
          </div>
          <div className="text-sm font-bold">{attendanceStats.normal}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            지각
          </div>
          <div className="text-sm font-bold">{attendanceStats.late}건</div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            조퇴
          </div>
          <div className="text-sm font-bold">
            {attendanceStats.earlyLeave}건
          </div>
        </div>
        <div className="px-5 py-4 border border-l-0 border-[#e2e5eb]">
          <div className="text-[11px] text-[#6b7280] font-semibold uppercase mb-1.5">
            총 근무시간
          </div>
          <div className="text-sm font-bold">
            {attendanceStats.totalHours}시간
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse">
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
              {attendanceLogs.map((row) => (
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
                    {row.log.totalMinutes ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {STATUS_LABEL[row.log.status]}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {row.log.signatureKey ? "✓" : "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {row.log.note ?? "-"}
                  </td>
                </tr>
              ))}
              {attendanceLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
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

      {/* 휴가 이력 */}
      <div className="mb-3">
        <span className="text-sm font-bold">휴가 이력</span>
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
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]"
                  >
                    휴가 이력이 없습니다.
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

export default ParticipantDetailPage;
