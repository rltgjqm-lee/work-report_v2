import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getMonthlyAttendance,
  getProgram,
  listPrograms,
} from "../api/admin/programs";
import { inputClass, selectClass } from "../uiClasses";
import type { AttendanceRow, AttendanceStats, Program } from "../types";

const STATUS_LABEL: Record<string, string> = {
  NORMAL: "정상",
  LATE: "지각",
  EARLY_LEAVE: "조퇴",
};

const emptyStats: AttendanceStats = {
  total: 0,
  normal: 0,
  late: 0,
  earlyLeave: 0,
  totalHours: 0,
};

const AttendancePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const preselectedProgramId = id ? Number(id) : null;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(id ?? "");
  const [programName, setProgramName] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [logs, setLogs] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState<AttendanceStats>(emptyStats);

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
    if (!programId) {
      setLogs([]);
      setStats(emptyStats);
      return;
    }
    getMonthlyAttendance(programId, month).then((result) => {
      setLogs(result.logs);
      setStats(result.stats);
    });
  }, [programId, month]);

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
              / 근태 조회
            </div>
          ) : null}
          <h1 className="text-[21px] font-bold m-0">근태 조회</h1>
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
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <tr key={row.log.id} className="hover:bg-[#f8fafc]">
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
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
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
        </>
      )}
    </div>
  );
};

export default AttendancePage;
