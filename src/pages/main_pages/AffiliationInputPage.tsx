import { useEffect, useMemo, useState } from "react";

import AttendanceCheckIn from "../../components/molecule/AttendanceCheckIn";
import AppBar from "../../components/molecule/AppBar";
import LabeledInput from "../../components/molecule/LabeledInput";
import ProgressBar from "../../components/atoms/ProgressBar";
import Card from "../../components/atoms/Card";
import BottomBar from "../../components/atoms/BottomBar";
import Button from "../../components/atoms/Button";
import {
  pageClass,
  bodyClass,
  labelClass,
  selectClass,
} from "../../components/atoms/classes";
import { validateForm } from "../../utils/validateFormData";
import { PAGE1_RULES } from "../../types/validationRules";
import { subscribeToPush } from "../../utils/pushSubscription";
import {
  getAffiliations,
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

  return (
    <div className={pageClass}>
      <AppBar title="기본 정보" />

      <ProgressBar step={1} />

      <div className={bodyClass}>
        <Card>
          <div className="flex gap-3.5">
            <div className="flex-1">
              {/* 시/도 */}
              <label className={labelClass}>시·도</label>
              <select
                className={selectClass + " w-full"}
                value={sido}
                onChange={(event) => handleSidoChange(event.target.value)}
              >
                <option value="">선택하세요</option>
                {sidoList.map((sido) => (
                  <option key={sido} value={sido}>
                    {sido}
                  </option>
                ))}
              </select>
            </div>

            {/* 시/군/구 */}
            <div className="flex-1">
              <label className={labelClass}>시·군·구</label>
              <select
                className={selectClass + " w-full"}
                value={sigungu}
                disabled={!sido}
                onChange={(event) => handleSigunguChange(event.target.value)}
              >
                <option value="">선택하세요</option>
                {sigunguList.map((sigungu) => (
                  <option key={sigungu} value={sigungu}>
                    {sigungu}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 기관 유형 */}
          <div className="flex gap-3.5">
            <div className="flex-1">
              <label className={labelClass}>기관 유형</label>
              <select
                className={selectClass + " w-full"}
                value={organizationType}
                disabled={!sigungu}
                onChange={(event) =>
                  handleOrganizationTypeChange(event.target.value)
                }
              >
                <option value="">선택하세요</option>
                {organizationTypeList.map((organizationType) => (
                  <option key={organizationType} value={organizationType}>
                    {organizationType}
                  </option>
                ))}
              </select>
            </div>

            {/* 소속 기관 */}
            <div className="flex-1">
              <label className={labelClass}>소속 기관명</label>
              <select
                className={selectClass + " w-full"}
                value={selectedOrganizationId}
                disabled={!organizationType}
                onChange={(event) =>
                  handleOrganizationChange(event.target.value)
                }
              >
                <option value="">선택하세요</option>
                {organizationCandidates.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 사업 유형 */}
          <div>
            <label className={labelClass}>사업 유형</label>
            <select
              className={selectClass + " w-full"}
              value={programType}
              disabled={!selectedOrganizationId}
              onChange={(event) => handleProgramTypeChange(event.target.value)}
            >
              <option value="">선택하세요</option>
              {programTypeList.map((programType) => (
                <option key={programType} value={programType}>
                  {programType}
                </option>
              ))}
            </select>
          </div>

          {/* 사업단 */}
          <div>
            <label className={labelClass}>사업단명</label>
            <select
              className={selectClass + " w-full"}
              value={selectedProgramId}
              disabled={!programType}
              onChange={(event) => handleProgramChange(event.target.value)}
            >
              <option value="">선택하세요</option>
              {programCandidates.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          {/* 수요처 */}
          <div>
            <LabeledInput
              labelTitle={
                <>
                  수요처명
                  <small className="ml-1.5 text-[13px] font-semibold text-[#9ca3af]">
                    서비스 대상자 명
                  </small>
                </>
              }
              id="demandName"
              placeholder="예) 00주민센터"
              value={formData.demandName}
              onChange={(event) => onChange("demandName", event.target.value)}
            />
          </div>

          {/* 성별 */}
          <div className="flex gap-3.5">
            <div className="flex-1">
              <label className={labelClass}>성별</label>
              <select
                className={selectClass + " w-full"}
                value={formData.gender}
                onChange={(event) =>
                  onChange(
                    "gender",
                    event.target.value as ActivityLogFormData["gender"],
                  )
                }
              >
                <option value="">선택하세요</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </select>
            </div>

            {/* 참여자명 */}
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
        </Card>

        {selectedProgramId && (
          <Card>
            <AttendanceCheckIn
              programId={Number(selectedProgramId)}
              onIdentified={(program) =>
                onChange("participantId", program.participantId)
              }
            />
          </Card>
        )}
      </div>

      <BottomBar>
        <Button
          variant="primary"
          disabled={!formData.participantId}
          onClick={handleNextButtonClick}
        >
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
