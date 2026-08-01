import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getProgram, listPrograms } from "../../api/admin/programs";
import { listDemandSites } from "../../api/admin/demandSites";
import FilterSelect from "../../components/FilterSelect";
import TabBar from "../../components/bar/TabBar";
import AttendanceTabPanel from "./AttendanceTabPanel";
import LeaveTabPanel from "./LeaveTabPanel";
import TrainingTabPanel from "./TrainingTabPanel";
import type { DemandSite, Participant, Program } from "../../types";

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
  const [programTypeFilter, setProgramTypeFilter] = useState("all");
  const [selectedProgramId, setSelectedProgramId] = useState<string>(id ?? "");
  const [programName, setProgramName] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [demandSites, setDemandSites] = useState<DemandSite[]>([]);
  const [selectedDemandSiteId, setSelectedDemandSiteId] = useState("");
  const [tab, setTab] = useState<Tab>("attendance");

  // 사이드바로 바로 들어온 경우(사업단 id 없음) 고를 수 있게 전체 사업단 목록을 가져온다
  useEffect(() => {
    if (!preselectedProgramId) listPrograms().then(setPrograms);
  }, [preselectedProgramId]);

  const programId = preselectedProgramId ?? Number(selectedProgramId);

  const filteredPrograms = useMemo(
    () =>
      programTypeFilter === "all"
        ? programs
        : programs.filter((program) => program.programType === programTypeFilter),
    [programs, programTypeFilter],
  );

  useEffect(() => {
    if (!programId) return;
    getProgram(programId).then((program) => {
      setProgramName(program.name);
      setParticipants(program.participants);
    });
    listDemandSites(programId).then(setDemandSites);
  }, [programId]);

  // 근태/교육/휴가 데이터에는 수요처 정보가 없고 참여자 id만 있다 —
  // 선택한 수요처 소속 참여자 id 집합을 만들어 각 탭에서 그걸로 걸러낸다.
  // 선택 안 했으면 null을 내려서 필터를 끈다.
  const filteredParticipantIds = useMemo(() => {
    if (!selectedDemandSiteId) return null;

    return new Set(
      participants
        .filter((participant) => String(participant.demandSiteId) === selectedDemandSiteId)
        .map((participant) => participant.id),
    );
  }, [participants, selectedDemandSiteId]);

  // 교육 탭에는 걸러낸 참여자 목록을 그대로 넘긴다 — JSX 안에서 만들면 렌더마다
  // 새 배열이 되어, 나중에 이 prop이 effect 의존성에 들어가는 순간 재요청이 돈다.
  const filteredParticipants = useMemo(
    () =>
      filteredParticipantIds
        ? participants.filter((participant) => filteredParticipantIds.has(participant.id))
        : participants,
    [participants, filteredParticipantIds],
  );

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          {preselectedProgramId ? (
            <div className="text-xs text-[#6b7280] mb-1.5">
              사업단 관리 /{" "}
              <a
                onClick={() => navigate(`/admin/programs/${preselectedProgramId}`)}
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
        <div className="flex items-center gap-2.5">
          {!preselectedProgramId && (
            <FilterSelect
              value={programTypeFilter}
              onChange={(value) => {
                setProgramTypeFilter(value);
                setSelectedProgramId("");
                setSelectedDemandSiteId("");
              }}
              options={[
                { value: "all", label: "전체 유형" },
                { value: "공익 활동", label: "공익 활동" },
                { value: "역량 활동", label: "역량 활동" },
              ]}
            />
          )}
          {!preselectedProgramId && (
            <FilterSelect
              value={selectedProgramId}
              onChange={(value) => {
                setSelectedProgramId(value);
                // 사업단이 바뀌면 이전 사업단의 수요처 선택은 더 이상 유효하지 않다
                setSelectedDemandSiteId("");
              }}
              options={[
                { value: "", label: "사업단을 선택하세요" },
                ...filteredPrograms.map((program) => ({
                  value: String(program.id),
                  label: program.name,
                })),
              ]}
            />
          )}
          {/* 사업단을 고르기 전에도 자리를 지킨다 — 고를 수 있는 수요처가 없을 뿐이라
              비활성 상태로 보여준다 (수요처 목록은 사업단에 딸려 있다) */}
          <FilterSelect
            value={selectedDemandSiteId}
            onChange={setSelectedDemandSiteId}
            disabled={!programId}
            options={[
              { value: "", label: "전체 수요처" },
              ...demandSites.map((demandSite) => ({
                value: String(demandSite.id),
                label: demandSite.name,
              })),
            ]}
          />
        </div>
      </div>

      {!programId ? (
        <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-10 text-center text-[13px] text-[#9aa1ab]">
          조회할 사업단을 선택해주세요.
        </div>
      ) : (
        <>
          <TabBar
            tabs={[
              ["attendance", "근태"],
              ["training", "교육"],
              ["leave", "휴가 현황"],
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === "attendance" && (
            <AttendanceTabPanel programId={programId} participantIds={filteredParticipantIds} />
          )}
          {tab === "training" && (
            <TrainingTabPanel
              programId={programId}
              participants={filteredParticipants}
              participantIds={filteredParticipantIds}
            />
          )}
          {tab === "leave" && (
            <LeaveTabPanel programId={programId} participantIds={filteredParticipantIds} />
          )}
        </>
      )}
    </div>
  );
};

export default AttendancePage;
