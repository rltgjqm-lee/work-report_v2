import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getProgram, listPrograms } from "../../api/admin/programs";
import FilterSelect from "../../components/FilterSelect";
import AttendanceTabPanel from "./AttendanceTabPanel";
import LeaveTabPanel from "./LeaveTabPanel";
import TrainingTabPanel from "./TrainingTabPanel";
import { tabBarClass, tabBtnActiveClass, tabBtnClass } from "../../uiClasses";
import type { Participant, Program } from "../../types";

type Tab = "attendance" | "training" | "leave";

/**
 * 관리자 페이지 > 근태 관리 페이지입니다. 근태/휴가/교육을 탭으로 묶어서 보여줍니다.
 *
 */
const AttendancePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const preselectedProgramId = id ? Number(id) : null;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(id ?? "");
  const [programName, setProgramName] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tab, setTab] = useState<Tab>("attendance");

  // 사이드바로 바로 들어온 경우(사업단 id 없음) 고를 수 있게 전체 사업단 목록을 가져온다
  useEffect(() => {
    if (!preselectedProgramId) listPrograms().then(setPrograms);
  }, [preselectedProgramId]);

  const programId = preselectedProgramId ?? Number(selectedProgramId);

  useEffect(() => {
    if (!programId) return;
    getProgram(programId).then((program) => {
      setProgramName(program.name);
      setParticipants(program.participants);
    });
  }, [programId]);

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
              / 근태 관리
            </div>
          ) : null}
          <h1 className="text-[21px] font-bold m-0">근태 관리</h1>
          <p className="text-[13px] text-[#6b7280] mt-1.5">
            참여자의 근태, 교육, 휴가 현황을 확인합니다.
          </p>
        </div>
        {!preselectedProgramId && (
          <FilterSelect
            value={selectedProgramId}
            onChange={setSelectedProgramId}
            options={[
              { value: "", label: "사업단을 선택하세요" },
              ...programs.map((program) => ({
                value: String(program.id),
                label: program.name,
              })),
            ]}
          />
        )}
      </div>

      {!programId ? (
        <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-10 text-center text-[13px] text-[#9aa1ab]">
          조회할 사업단을 선택해주세요.
        </div>
      ) : (
        <>
          <div className={tabBarClass}>
            {(
              [
                ["attendance", "근태"],
                ["training", "교육"],
                ["leave", "휴가 현황"],
              ] as [Tab, string][]
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={tab === tabKey ? tabBtnActiveClass : tabBtnClass}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "attendance" && <AttendanceTabPanel programId={programId} />}
          {tab === "training" && (
            <TrainingTabPanel programId={programId} participants={participants} />
          )}
          {tab === "leave" && <LeaveTabPanel programId={programId} />}
        </>
      )}
    </div>
  );
};

export default AttendancePage;
