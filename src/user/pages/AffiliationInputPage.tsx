import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import AppBar from "../components/molecule/AppBar";
import PageHeaderCard from "../components/molecule/PageHeaderCard";
import Dropdown from "../components/molecule/Dropdown";
import LabeledInput from "../components/molecule/LabeledInput";
import Card from "../components/atoms/Card";
import ExceptionCard from "../components/atoms/ExceptionCard";
import BottomBar from "../components/atoms/BottomBar";
import Button from "../../components/atoms/Button";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { validateForm } from "../../utils/validateFormData";
import { affiliationsQueryOptions } from "../../utils/affiliationsApi";
import { demandSitesQueryOptions } from "../../utils/demandSitesApi";
import { KOREAN_REGIONS, SIDO_LIST } from "../../constants/koreanRegions";

import type { Affiliations } from "../../utils/affiliationsApi";
import type { ActivityLogFormData } from "../../types/form";
import type { ValidationRule } from "../../utils/validateFormData";

// 💡 이 페이지(기본정보 입력)에서만 쓰는 검증 규칙이라 여기 직접 둔다.
const PAGE1_RULES: ValidationRule[] = [
  { field: "orgName", message: "(1) 기관명을 넣어주세요" },
  { field: "programName", message: "(2) 참여사업명을 넣어주세요" },
  { field: "userName", message: "(3) 참여자성명을 넣어주세요" },
  { field: "demandName", message: "(4) 수요처명을 넣어주세요" },
  { field: "gender", message: "(5) 성별을 선택해주세요" },
];

const PLACEHOLDER_OPTION = { value: "", label: "선택하세요" };

const GENDER_OPTIONS = [
  PLACEHOLDER_OPTION,
  { value: "남성", label: "남성" },
  { value: "여성", label: "여성" },
];

const toOptions = (values: string[]) => [
  PLACEHOLDER_OPTION,
  ...values.map((value) => ({ value, label: value })),
];

// 💡 localStorage에 저장된 기관/사업단을 매칭한다
const findRestoredSelection = (
  affiliations: Affiliations,
  orgName: string,
  programName: string,
) => {
  const organization = affiliations.organizations.find((candidate) => candidate.name === orgName);
  if (!organization) return null;

  const program = affiliations.programs.find(
    (candidate) => candidate.organizationId === organization.id && candidate.name === programName,
  );

  return { organization, program: program ?? null };
};

/**
 * Page 1: 사용자 정보 입력 — 지역/기관유형/사업유형 캐스케이딩 선택
 */
const AffiliationInputPage = ({
  formData,
  onChange,
  onBack,
  onNext,
  onAlert,
}: {
  formData: ActivityLogFormData;
  onChange: <T extends keyof ActivityLogFormData>(key: T, value: ActivityLogFormData[T]) => void;
  onBack: () => void;
  onNext: () => void;
  onAlert: (messages: string[]) => void;
}) => {
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [programType, setProgramType] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");

  // 💡 사업단 수가 많지 않아 조직 선택을 기다리지 않고 전체 목록을 한 번의 API
  // 호출로 불러온 뒤 organizationId로 클라이언트에서 필터링한다
  const {
    data: affiliations,
    isSuccess: affiliationsLoaded,
    isError: affiliationsErrored,
  } = useQuery(affiliationsQueryOptions);
  const organizations = useMemo(() => affiliations?.organizations ?? [], [affiliations]);
  const programs = useMemo(() => affiliations?.programs ?? [], [affiliations]);

  useEffect(() => {
    if (affiliationsErrored) {
      onAlert(["기관/사업단 목록을 불러오지 못했습니다", "네트워크 상태를 확인해주세요"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliationsErrored]);

  // 💡 로컬스토리지에서 복원된 formData.orgName/programName이 있으면 이름으로 매칭해
  // 지역/기관유형/기관/사업유형/사업단 드롭다운 항목을 선택한다
  const hasRestoredSelectionRef = useRef(false);

  useEffect(() => {
    if (!affiliations || hasRestoredSelectionRef.current) return;
    hasRestoredSelectionRef.current = true;

    if (!formData.orgName) return;

    const restored = findRestoredSelection(affiliations, formData.orgName, formData.programName);

    if (!restored) return;

    const { organization, program } = restored;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 복원된 formData를 드롭다운 선택 상태로 되돌린다
    setSido(organization.regionSido ?? "");
    setSigungu(organization.regionSigungu ?? "");
    setSelectedOrganizationId(String(organization.id));

    if (!program) return;

    setProgramType(program.programType ?? "");
    setSelectedProgramId(String(program.id));
    onChange("programType", (program.programType ?? "") as ActivityLogFormData["programType"]);
    onChange("programId", program.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliations]);

  const demandSitesQueryConfig = {
    ...demandSitesQueryOptions(Number(selectedProgramId)),
    enabled: !!selectedProgramId,
  };
  const { data: demandSites = [], isError: demandSitesErrored } = useQuery(demandSitesQueryConfig);

  useEffect(() => {
    if (demandSitesErrored) {
      onAlert(["수요처 목록을 불러오지 못했습니다", "네트워크 상태를 확인해주세요"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandSitesErrored]);

  // 💡 등록된 기관이 있는 지역만이 아니라 전국 시/도·시/군/구를 다 보여준다 — 아직 기관이
  // 등록되지 않은 지역이라도 참여자가 자기 지역을 선택할 수 있어야 한다.
  const sidoList = SIDO_LIST;

  const sigunguList = useMemo(() => KOREAN_REGIONS[sido] ?? [], [sido]);

  const organizationCandidates = useMemo(
    () =>
      organizations.filter(
        (organization) =>
          organization.regionSido === sido && organization.regionSigungu === sigungu,
      ),
    [organizations, sido, sigungu],
  );

  const organizationPrograms = useMemo(
    () => programs.filter((program) => program.organizationId === Number(selectedOrganizationId)),
    [programs, selectedOrganizationId],
  );

  const programTypeList = useMemo(
    () =>
      Array.from(
        new Set(organizationPrograms.map((program) => program.programType).filter(Boolean)),
      ) as string[],
    [organizationPrograms],
  );

  const programCandidates = useMemo(
    () => organizationPrograms.filter((program) => program.programType === programType),
    [organizationPrograms, programType],
  );

  // 💡 각 Dropdown에 넘길 옵션 목록 — 위 후보 목록들을 { value, label } 형태로 변환해 한 곳에 모은다
  const sidoOptions = useMemo(() => toOptions(sidoList), [sidoList]);
  const sigunguOptions = useMemo(() => toOptions(sigunguList), [sigunguList]);
  const organizationOptions = useMemo(
    () => [
      PLACEHOLDER_OPTION,
      ...organizationCandidates.map((organization) => ({
        value: String(organization.id),
        label: organization.name,
      })),
    ],
    [organizationCandidates],
  );
  const programTypeOptions = useMemo(() => toOptions(programTypeList), [programTypeList]);
  const programOptions = useMemo(
    () => [
      PLACEHOLDER_OPTION,
      ...programCandidates.map((program) => ({
        value: String(program.id),
        label: program.name,
      })),
    ],
    [programCandidates],
  );
  const demandSiteOptions = useMemo(
    () => toOptions(demandSites.map((demandSite) => demandSite.name)),
    [demandSites],
  );
  const dropdownOptions = {
    sido: sidoOptions,
    sigungu: sigunguOptions,
    organization: organizationOptions,
    programType: programTypeOptions,
    program: programOptions,
    demandSite: demandSiteOptions,
  };

  // 💡 핸들러 — 상위 드롭다운이 바뀌면 하위 선택값을 초기화한다
  const handleSidoChange = (value: string) => {
    setSido(value);
    setSigungu("");
    setSelectedOrganizationId("");
    setProgramType("");
    setSelectedProgramId("");
  };

  const handleSigunguChange = (value: string) => {
    setSigungu(value);
    setSelectedOrganizationId("");
    setProgramType("");
    setSelectedProgramId("");
  };

  const handleOrganizationChange = (orgId: string) => {
    setSelectedOrganizationId(orgId);
    setProgramType("");
    setSelectedProgramId("");
    onChange(
      "orgName",
      organizations.find((organization) => String(organization.id) === orgId)?.name ?? "",
    );
    onChange("programName", "");
  };

  const handleProgramTypeChange = (value: string) => {
    setProgramType(value);
    setSelectedProgramId("");
    onChange("programName", "");
    onChange("programType", value as ActivityLogFormData["programType"]);
  };

  const handleProgramChange = (programId: string) => {
    setSelectedProgramId(programId);
    onChange(
      "programName",
      programs.find((program) => String(program.id) === programId)?.name ?? "",
    );
    onChange("programId", programId ? Number(programId) : undefined);
    onChange("demandName", "");
  };

  const handleNextButtonClick = () => {
    const errors = validateForm(formData, PAGE1_RULES);

    if (errors.length > 0) {
      onAlert(errors);
      return;
    }

    onNext();
  };

  return (
    <div className={pageClass}>
      <AppBar title="기본 정보" onBack={onBack} />

      <div className={bodyClass}>
        <PageHeaderCard
          icon="/icons/icon-basic-info.png"
          title="기본정보 등록"
          subtitle="참여자 정보를 입력해주세요"
        />

        {affiliationsLoaded && organizations.length === 0 && (
          <ExceptionCard
            variant="warn"
            title="등록된 사업이 없습니다."
            note={
              <>
                기관 혹은 사업 담당자에게
                <br />
                문의해 주세요.
              </>
            }
          />
        )}

        <Card>
          <div className="flex gap-3.5">
            {/* 시/도 */}
            <Dropdown
              label="시·도"
              value={sido}
              onChange={handleSidoChange}
              options={dropdownOptions.sido}
            />

            {/* 시/군/구 */}
            <Dropdown
              label="시·군·구"
              value={sigungu}
              disabled={!sido}
              onChange={handleSigunguChange}
              options={dropdownOptions.sigungu}
            />
          </div>

          {/* 소속 기관명 / 사업 유형 */}
          <div className="flex gap-3.5">
            <Dropdown
              label="소속 기관명"
              value={selectedOrganizationId}
              disabled={!sigungu}
              onChange={handleOrganizationChange}
              options={dropdownOptions.organization}
            />

            <Dropdown
              label="사업 유형"
              value={programType}
              disabled={!selectedOrganizationId}
              onChange={handleProgramTypeChange}
              options={dropdownOptions.programType}
            />
          </div>

          {/* 사업단 */}
          <Dropdown
            label="사업단명"
            value={selectedProgramId}
            disabled={!programType}
            onChange={handleProgramChange}
            options={dropdownOptions.program}
          />

          {/* 수요처 */}
          <Dropdown
            label={"수요처명"}
            value={formData.demandName}
            disabled={!selectedProgramId}
            onChange={(value) => onChange("demandName", value)}
            options={dropdownOptions.demandSite}
          />

          {/* 성별/참여자 성함 */}
          <div className="flex gap-3.5">
            <Dropdown
              label="성별"
              value={formData.gender}
              onChange={(value) => onChange("gender", value as ActivityLogFormData["gender"])}
              options={GENDER_OPTIONS}
            />
            <div className="flex-1">
              <LabeledInput
                labelTitle="참여자 성함"
                id="userName"
                placeholder="성함 입력"
                value={formData.userName}
                onChange={(event) => onChange("userName", event.target.value)}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                동명이인이 있으면 이름 뒤에 숫자를 붙여주세요
                <br />
                (예: 홍길동1)
              </p>
            </div>
          </div>
        </Card>
      </div>

      <BottomBar>
        <Button variant="primary" onClick={handleNextButtonClick}>
          다음
        </Button>
      </BottomBar>
    </div>
  );
};

export default AffiliationInputPage;
