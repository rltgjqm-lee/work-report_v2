import { useEffect, useMemo, useState } from "react";

import AppBar from "../../components/molecule/AppBar";
import Dropdown from "../../components/molecule/Dropdown";
import LabeledInput from "../../components/molecule/LabeledInput";
import ProgressBar from "../../components/atoms/ProgressBar";
import Card from "../../components/atoms/Card";
import ExceptionCard from "../../components/atoms/ExceptionCard";
import BottomBar from "../../components/atoms/BottomBar";
import Button from "../../components/atoms/Button";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { validateForm } from "../../utils/validateFormData";
import { PAGE1_RULES } from "../../types/validationRules";
import { subscribeToPush } from "../../utils/pushSubscription";
import {
  getAffiliations,
  getDemandSites,
  type DemandSite,
  type Organization,
  type Program,
} from "../../utils/publicApi";

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
  onChange: <T extends keyof ActivityLogFormData>(
    key: T,
    value: ActivityLogFormData[T],
  ) => void;
  onNext: () => void;
  onAlert: (messages: string[]) => void;
}) => {
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");

  const [organizationType, setOrganizationType] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [programType, setProgramType] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");

  const [demandSites, setDemandSites] = useState<DemandSite[]>([]);
  const [affiliationsLoaded, setAffiliationsLoaded] = useState(false);

  // 💡 사업단 수가 많지 않아 조직 선택을 기다리지 않고 전체 목록을 한 번의 API
  // 호출로 불러온 뒤 organizationId로 클라이언트에서 필터링한다
  useEffect(() => {
    getAffiliations()
      .then(
        ({
          organizations: fetchedOrganizations,
          programs: fetchedPrograms,
        }) => {
          setOrganizations(fetchedOrganizations);
          setPrograms(fetchedPrograms);
          setAffiliationsLoaded(true);

          // 💡 로컬스토리지에서 복원된 formData.orgName/programName이 있으면 이름으로
          // 매칭해 지역/기관유형/기관/사업유형/사업단 드롭다운 선택 상태를 역으로 채운다
          if (!formData.orgName) return;

          const matchedOrganization = fetchedOrganizations.find(
            (organization) => organization.name === formData.orgName,
          );
          if (!matchedOrganization) return;

          setSido(matchedOrganization.regionSido ?? "");
          setSigungu(matchedOrganization.regionSigungu ?? "");
          setOrganizationType(matchedOrganization.organizationType ?? "");
          setSelectedOrganizationId(String(matchedOrganization.id));

          if (!formData.programName) return;

          const matchedProgram = fetchedPrograms.find(
            (program) =>
              program.organizationId === matchedOrganization.id &&
              program.name === formData.programName,
          );
          if (!matchedProgram) return;

          setProgramType(matchedProgram.programType ?? "");
          setSelectedProgramId(String(matchedProgram.id));
        },
      )
      .catch(() => {
        onAlert([
          "기관/사업단 목록을 불러오지 못했습니다. 네트워크 상태를 확인해주세요.",
        ]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 💡 사업단을 바꾸면 이전 사업단의 수요처 선택이 남아있으면 안 되므로 목록을 다시
  // 불러오는 동안 선택값도 초기화한다.
  useEffect(() => {
    if (!selectedProgramId) return;
    getDemandSites(Number(selectedProgramId))
      .then(setDemandSites)
      .catch(() => {
        onAlert([
          "수요처 목록을 불러오지 못했습니다. 네트워크 상태를 확인해주세요.",
        ]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  const sidoList = useMemo(
    () =>
      Array.from(
        new Set(
          organizations
            .map((organization) => organization.regionSido)
            .filter(Boolean),
        ),
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

  const organizationTypeList = useMemo(
    () =>
      Array.from(
        new Set(
          organizations
            .filter(
              (organization) =>
                organization.regionSido === sido &&
                organization.regionSigungu === sigungu,
            )
            .map((organization) => organization.organizationType)
            .filter(Boolean),
        ),
      ) as string[],
    [organizations, sido, sigungu],
  );

  const organizationCandidates = useMemo(
    () =>
      organizations.filter(
        (organization) =>
          organization.regionSido === sido &&
          organization.regionSigungu === sigungu &&
          organization.organizationType === organizationType,
      ),
    [organizations, sido, sigungu, organizationType],
  );

  const organizationPrograms = useMemo(
    () =>
      programs.filter(
        (program) => program.organizationId === Number(selectedOrganizationId),
      ),
    [programs, selectedOrganizationId],
  );

  const programTypeList = useMemo(
    () =>
      Array.from(
        new Set(
          organizationPrograms
            .map((program) => program.programType)
            .filter(Boolean),
        ),
      ) as string[],
    [organizationPrograms],
  );

  const programCandidates = useMemo(
    () =>
      organizationPrograms.filter(
        (program) => program.programType === programType,
      ),
    [organizationPrograms, programType],
  );

  const handleSidoChange = (value: string) => {
    setSido(value);
    setSigungu("");
    setOrganizationType("");
    setSelectedOrganizationId("");
    setProgramType("");
    setSelectedProgramId("");
  };

  const handleSigunguChange = (value: string) => {
    setSigungu(value);
    setOrganizationType("");
    setSelectedOrganizationId("");
    setProgramType("");
    setSelectedProgramId("");
  };

  const handleOrganizationTypeChange = (value: string) => {
    setOrganizationType(value);
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
      organizations.find((organization) => String(organization.id) === orgId)
        ?.name ?? "",
    );
    onChange("programName", "");
  };

  const handleProgramTypeChange = (value: string) => {
    setProgramType(value);
    setSelectedProgramId("");
    onChange("programName", "");
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

  const handleSaveDraftButtonClick = () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.FORM_DRAFT,
      JSON.stringify(formData),
    );

    if (selectedProgramId) {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.SELECTED_PROGRAM_ID,
        selectedProgramId,
      );
      subscribeToPush(Number(selectedProgramId));
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

  if (affiliationsLoaded && organizations.length === 0) {
    return (
      <div className={pageClass}>
        <AppBar title="기본 정보" />
        <div className={bodyClass}>
          <ExceptionCard variant="warn">
            <strong>등록된 사업이 없습니다.</strong>
            <br />
            <br />
            기관 혹은 사업 담당자에게 문의해 주세요.
          </ExceptionCard>
        </div>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <AppBar title="기본 정보" />

      <ProgressBar step={1} />

      <div className={bodyClass}>
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

          {/* 기관 유형 */}
          <div className="flex gap-3.5">
            <Dropdown
              label="기관 유형"
              value={organizationType}
              disabled={!sigungu}
              onChange={handleOrganizationTypeChange}
              options={[
                { value: "", label: "선택하세요" },
                ...organizationTypeList.map((organizationTypeOption) => ({
                  value: organizationTypeOption,
                  label: organizationTypeOption,
                })),
              ]}
            />

            {/* 소속 기관 */}
            <Dropdown
              label="소속 기관명"
              value={selectedOrganizationId}
              disabled={!organizationType}
              onChange={handleOrganizationChange}
              options={[
                { value: "", label: "선택하세요" },
                ...organizationCandidates.map((organization) => ({
                  value: String(organization.id),
                  label: organization.name,
                })),
              ]}
            />
          </div>

          {/* 사업 유형 */}
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
              onChange={(value) =>
                onChange("gender", value as ActivityLogFormData["gender"])
              }
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
            </div>
          </div>

          {/* 전화번호 뒷자리 (동명이인 구분용) */}
          <div>
            <LabeledInput
              labelTitle="전화번호 뒷자리(4자리)"
              id="phoneLast4"
              placeholder="0000"
              value={formData.phoneLast4}
              onChange={(event) =>
                onChange(
                  "phoneLast4",
                  event.target.value.replace(/\D/g, "").slice(0, 4),
                )
              }
            />
          </div>
        </Card>
      </div>

      <BottomBar>
        <Button variant="primary" onClick={handleNextButtonClick}>
          다음
        </Button>
        <Button
          variant="text"
          className="self-center"
          onClick={handleSaveDraftButtonClick}
        >
          나중에 이어서 작성하고 저장만 하기
        </Button>
      </BottomBar>
    </div>
  );
};

export default AffiliationInputPage;
