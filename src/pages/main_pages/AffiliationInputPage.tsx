import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import AppBar from "../../components/molecule/AppBar";
import Dropdown from "../../components/molecule/Dropdown";
import LabeledInput from "../../components/molecule/LabeledInput";
import Card from "../../components/atoms/Card";
import ExceptionCard from "../../components/atoms/ExceptionCard";
import BottomBar from "../../components/atoms/BottomBar";
import Button from "../../components/atoms/Button";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { validateForm } from "../../utils/validateFormData";
import { PAGE1_RULES } from "../../types/validationRules";
import { subscribeToPush } from "../../utils/pushSubscription";
import { registerNativePush } from "../../utils/nativePushRegistration";
import { affiliationsQueryOptions, demandSitesQueryOptions } from "../../utils/publicApi";

import type { ActivityLogFormData } from "../../types/form";
import { LOCAL_STORAGE_KEYS } from "../../constants/storage";

/**
 * Page 1: 사용자 정보 입력 — 지역/기관유형/사업유형 캐스케이딩 선택
 */
const AffiliationInputPage = ({
  formData,
  onChange,
  onNext,
  onAlert,
}: {
  formData: ActivityLogFormData;
  onChange: <T extends keyof ActivityLogFormData>(key: T, value: ActivityLogFormData[T]) => void;
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
      onAlert(["기관/사업단 목록을 불러오지 못했습니다. 네트워크 상태를 확인해주세요."]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliationsErrored]);

  // 💡 로컬스토리지에서 복원된 formData.orgName/programName이 있으면 이름으로 매칭해
  // 지역/기관유형/기관/사업유형/사업단 드롭다운 선택 상태를 역으로 채운다 — 목록이
  // 도착한 직후 한 번만 시도한다(다시 불러와도 사용자가 이미 고른 값을 덮어쓰지 않도록).
  const hasRestoredSelectionRef = useRef(false);
  useEffect(() => {
    if (!affiliations || hasRestoredSelectionRef.current) return;
    hasRestoredSelectionRef.current = true;

    if (!formData.orgName) return;

    const matchedOrganization = affiliations.organizations.find(
      (organization) => organization.name === formData.orgName,
    );
    if (!matchedOrganization) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 복원된 formData를 드롭다운 선택 상태로 되돌린다
    setSido(matchedOrganization.regionSido ?? "");
    setSigungu(matchedOrganization.regionSigungu ?? "");
    setSelectedOrganizationId(String(matchedOrganization.id));

    if (!formData.programName) return;

    const matchedProgram = affiliations.programs.find(
      (program) =>
        program.organizationId === matchedOrganization.id && program.name === formData.programName,
    );
    if (!matchedProgram) return;

    setProgramType(matchedProgram.programType ?? "");
    setSelectedProgramId(String(matchedProgram.id));
    onChange(
      "programType",
      (matchedProgram.programType ?? "") as ActivityLogFormData["programType"],
    );
    onChange("programId", matchedProgram.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliations]);

  // 💡 사업단을 바꾸면 이전 사업단의 수요처 선택이 남아있으면 안 되므로 목록을 다시
  // 불러오는 동안 선택값도 초기화한다.
  const { data: demandSites = [], isError: demandSitesErrored } = useQuery({
    ...demandSitesQueryOptions(Number(selectedProgramId)),
    enabled: !!selectedProgramId,
  });

  useEffect(() => {
    if (demandSitesErrored) {
      onAlert(["수요처 목록을 불러오지 못했습니다. 네트워크 상태를 확인해주세요."]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandSitesErrored]);

  const sidoList = useMemo(
    () =>
      Array.from(
        new Set(organizations.map((organization) => organization.regionSido).filter(Boolean)),
      ) as string[],
    [organizations],
  );

  const sigunguList = useMemo(
    () =>
      Array.from(
        new Set(
          organizations
            .filter((organization) => organization.regionSido === sido)
            .map((organization) => organization.regionSigungu)
            .filter(Boolean),
        ),
      ) as string[],
    [organizations, sido],
  );

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

  // 💡 formData 자체는 Main.tsx가 바뀔 때마다 자동으로 draft 저장하므로, 여기서는
  // 푸시 구독에 필요한 사업단 ID만 별도로 챙긴다.
  const handleSaveDraftButtonClick = () => {
    if (selectedProgramId) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SELECTED_PROGRAM_ID, selectedProgramId);
      subscribeToPush(Number(selectedProgramId));
      registerNativePush(Number(selectedProgramId));
    }
  };

  const handleNextButtonClick = () => {
    const errors = validateForm(formData, PAGE1_RULES);

    if (errors.length > 0) {
      onAlert(errors);
      return;
    }

    handleSaveDraftButtonClick();
    onNext();
  };

  return (
    <div className={pageClass}>
      <AppBar title="기본 정보" />

      <div className={bodyClass}>
        {affiliationsLoaded && organizations.length === 0 && (
          <ExceptionCard variant="warn">
            <strong>등록된 사업이 없습니다.</strong>
            <br />
            기관 혹은 사업 담당자에게 문의해 주세요.
          </ExceptionCard>
        )}

        <Card>
          <div className="flex gap-3.5">
            {/* 시/도 */}
            <Dropdown
              label="시·도"
              value={sido}
              onChange={handleSidoChange}
              options={[
                { value: "", label: "선택하세요" },
                ...sidoList.map((sidoOption) => ({
                  value: sidoOption,
                  label: sidoOption,
                })),
              ]}
            />

            {/* 시/군/구 */}
            <Dropdown
              label="시·군·구"
              value={sigungu}
              disabled={!sido}
              onChange={handleSigunguChange}
              options={[
                { value: "", label: "선택하세요" },
                ...sigunguList.map((sigunguOption) => ({
                  value: sigunguOption,
                  label: sigunguOption,
                })),
              ]}
            />
          </div>

          {/* 소속 기관명 / 사업 유형 */}
          <div className="flex gap-3.5">
            <Dropdown
              label="소속 기관명"
              value={selectedOrganizationId}
              disabled={!sigungu}
              onChange={handleOrganizationChange}
              options={[
                { value: "", label: "선택하세요" },
                ...organizationCandidates.map((organization) => ({
                  value: String(organization.id),
                  label: organization.name,
                })),
              ]}
            />

            <Dropdown
              label="사업 유형"
              value={programType}
              disabled={!selectedOrganizationId}
              onChange={handleProgramTypeChange}
              options={[
                { value: "", label: "선택하세요" },
                ...programTypeList.map((programTypeOption) => ({
                  value: programTypeOption,
                  label: programTypeOption,
                })),
              ]}
            />
          </div>

          {/* 사업단 */}
          <Dropdown
            label="사업단명"
            value={selectedProgramId}
            disabled={!programType}
            onChange={handleProgramChange}
            options={[
              { value: "", label: "선택하세요" },
              ...programCandidates.map((program) => ({
                value: String(program.id),
                label: program.name,
              })),
            ]}
          />

          {/* 수요처 */}
          <Dropdown
            label={
              <>
                수요처명
                <small className="ml-1.5 text-[13px] font-semibold text-[#9ca3af]">
                  서비스 대상자 명
                </small>
              </>
            }
            value={formData.demandName}
            disabled={!selectedProgramId}
            onChange={(value) => onChange("demandName", value)}
            options={[
              { value: "", label: "선택하세요" },
              ...demandSites.map((demandSite) => ({
                value: demandSite.name,
                label: demandSite.name,
              })),
            ]}
          />

          {/* 성별/참여자 성함 */}
          <div className="flex gap-3.5">
            <Dropdown
              label="성별"
              value={formData.gender}
              onChange={(value) => onChange("gender", value as ActivityLogFormData["gender"])}
              options={[
                { value: "", label: "선택하세요" },
                { value: "남성", label: "남성" },
                { value: "여성", label: "여성" },
              ]}
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
