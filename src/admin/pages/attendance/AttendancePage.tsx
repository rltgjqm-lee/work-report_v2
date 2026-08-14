import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { demandSitesQueryOptions } from "../../api/admin/demandSites";
import { programsQueryOptions } from "../../api/admin/programs";
import { PROGRAM_TYPE_FILTER_OPTIONS } from "../../constants/programTypes";

import TabBar from "../../components/bar/TabBar";
import FilterSelect from "../../components/FilterSelect";

import AttendanceTabPanel from "./AttendanceTabPanel";
import LeaveTabPanel from "./LeaveTabPanel";
import TrainingTabPanel from "./TrainingTabPanel";

type Tab = "attendance" | "training" | "leave";

/**
 * 관리자 페이지 > 근무 관리 페이지입니다. 근무/휴가/교육을 탭으로 묶어서 보여줍니다.
 *
 */
const AttendancePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const programIdParam = searchParams.get("programId");
  const preselectedProgramId = programIdParam ? Number(programIdParam) : null;

  const [programTypeFilter, setProgramTypeFilter] = useState("all");
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programIdParam ?? "");
  const [selectedDemandSiteId, setSelectedDemandSiteId] = useState("");
  const [tab, setTab] = useState<Tab>("attendance");

  // 사이드바로 바로 들어온 경우(사업단 id 없음) 전체 사업단 목록을 가져온다
  const { data: programs = [] } = useQuery({
    ...programsQueryOptions,
    enabled: !preselectedProgramId,
  });

  const programId = preselectedProgramId ?? Number(selectedProgramId);

  const filteredPrograms = useMemo(
    () =>
      programTypeFilter === "all"
        ? programs
        : programs.filter((program) => program.programType === programTypeFilter),
    [programs, programTypeFilter],
  );

  const { data: demandSitesData } = useQuery({
    ...demandSitesQueryOptions(programId),
    enabled: !!programId,
  });
  const demandSites = demandSitesData?.demandSites ?? [];
  const programName = demandSitesData?.programName ?? "";

  const demandSiteId = selectedDemandSiteId ? Number(selectedDemandSiteId) : null;

  const handleProgramTypeFilterChange = (value: string) => {
    setProgramTypeFilter(value);
    setSelectedProgramId("");
    setSelectedDemandSiteId("");
  };

  const handleProgramFilterChange = (value: string) => {
    setSelectedProgramId(value);
    setSelectedDemandSiteId("");
  };

  const programOptions = [
    { value: "", label: "사업단을 선택하세요" },
    ...filteredPrograms.map((program) => ({
      value: String(program.id),
      label: program.name,
    })),
  ];

  const demandSiteOptions = [
    { value: "", label: "전체 수요처" },
    ...demandSites.map((demandSite) => ({
      value: String(demandSite.id),
      label: demandSite.name,
    })),
  ];

  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          {preselectedProgramId ? (
            <div className="text-xs text-text-subtle mb-1.5">
              사업단 관리 /{" "}
              <a
                onClick={() => navigate(`/admin/program?id=${preselectedProgramId}`)}
                className="cursor-pointer text-admin-brand hover:text-admin-brand-dark"
              >
                {programName || "사업단 상세"}
              </a>{" "}
              / 근무 관리
            </div>
          ) : null}
          <h1 className="text-[21px] font-bold m-0">근무 관리</h1>
          <p className="text-[13px] text-text-subtle mt-1.5">
            참여자의 근무, 교육, 휴가 현황을 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {!preselectedProgramId && (
            <FilterSelect
              value={programTypeFilter}
              onChange={handleProgramTypeFilterChange}
              options={PROGRAM_TYPE_FILTER_OPTIONS}
            />
          )}
          {!preselectedProgramId && (
            <FilterSelect
              value={selectedProgramId}
              onChange={handleProgramFilterChange}
              options={programOptions}
            />
          )}
          <FilterSelect
            value={selectedDemandSiteId}
            onChange={setSelectedDemandSiteId}
            disabled={!programId}
            options={demandSiteOptions}
          />
        </div>
      </div>

      <TabBar
        tabs={[
          ["attendance", "근무"],
          ["training", "교육"],
          ["leave", "휴가 현황"],
        ]}
        active={tab}
        onChange={setTab}
      />

      {!programId ? (
        <div className="bg-white border border-admin-border-subtle rounded-[2px] px-5 py-10 text-center text-[13px] text-admin-text-placeholder">
          조회할 사업단을 선택해주세요.
        </div>
      ) : (
        <>
          {tab === "attendance" && (
            <AttendanceTabPanel programId={programId} demandSiteId={demandSiteId} />
          )}
          {tab === "training" && (
            <TrainingTabPanel programId={programId} demandSiteId={demandSiteId} />
          )}
          {tab === "leave" && <LeaveTabPanel programId={programId} demandSiteId={demandSiteId} />}
        </>
      )}
    </div>
  );
};

export default AttendancePage;
