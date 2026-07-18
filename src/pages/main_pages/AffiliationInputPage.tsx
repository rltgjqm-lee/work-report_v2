import { useEffect, useMemo, useState } from "react";

import AttendanceCheckIn from "../../components/molecule/AttendanceCheckIn";
import AppBar from "../../components/molecule/AppBar";
import ProgressBar from "../../components/atoms/ProgressBar";
import Card from "../../components/atoms/Card";
import BottomBar from "../../components/atoms/BottomBar";
import {
  pageClass,
  bodyClass,
  labelClass,
  labelSmallClass,
  inputClass,
  selectClass,
  btnPrimaryClass,
  btnTextClass,
} from "../../components/atoms/classes";
import { validateForm } from "../../utils/validateFormData";
import { PAGE1_RULES } from "../../types/validationRules";
import { subscribeToPush } from "../../utils/pushSubscription";
import {
  listPublicOrganizations,
  listPublicPrograms,
  type PublicOrganization,
  type PublicProgram,
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
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [programType, setProgramType] = useState("");
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");

  useEffect(() => {
    listPublicOrganizations()
      .then(setOrganizations)
      .catch(() => {
        onAlert([
          "기관 목록을 불러오지 못했습니다. 네트워크 상태를 확인해주세요.",
        ]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedOrganizationId) return;

    listPublicPrograms(Number(selectedOrganizationId))
      .then(setPrograms)
      .catch(() => onAlert(["사업단 목록을 불러오지 못했습니다."]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrganizationId]);

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

  const programTypeList = useMemo(
    () =>
      Array.from(
        new Set(programs.map((program) => program.programType).filter(Boolean)),
      ) as string[],
    [programs],
  );

  const programCandidates = useMemo(
    () => programs.filter((program) => program.programType === programType),
    [programs, programType],
  );

  const handleSelectSido = (value: string) => {
    setSido(value);
    setSigungu("");
    setOrganizationType("");
    setSelectedOrganizationId("");
    setPrograms([]);
    setProgramType("");
    setSelectedProgramId("");
  };

  const handleSelectSigungu = (value: string) => {
    setSigungu(value);
    setOrganizationType("");
    setSelectedOrganizationId("");
    setPrograms([]);
    setProgramType("");
    setSelectedProgramId("");
  };

  const handleSelectOrganizationType = (value: string) => {
    setOrganizationType(value);
    setSelectedOrganizationId("");
    setPrograms([]);
    setProgramType("");
    setSelectedProgramId("");
  };

  const handleSelectOrg = (orgId: string) => {
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

  const handleSelectProgramType = (value: string) => {
    setProgramType(value);
    setSelectedProgramId("");
    onChange("programName", "");
  };

  const handleSelectProgram = (programId: string) => {
    setSelectedProgramId(programId);
    onChange(
      "programName",
      programs.find((program) => String(program.id) === programId)?.name ?? "",
    );
  };

  const saveToLocalStorage = () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CONF_ORG, formData.orgName);
    localStorage.setItem(LOCAL_STORAGE_KEYS.CONF_PROGRAM, formData.programName);
    localStorage.setItem(LOCAL_STORAGE_KEYS.CONF_DEMAND, formData.demandName);
    localStorage.setItem(LOCAL_STORAGE_KEYS.CONF_USER, formData.userName);

    if (selectedProgramId) {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.SELECTED_PROGRAM_ID,
        selectedProgramId,
      );
      subscribeToPush(Number(selectedProgramId));
    }
  };

  const handleClickNextButton = () => {
    const errors = validateForm(formData, PAGE1_RULES);

    if (errors.length > 0) {
      onAlert(errors);
      return;
    }

    if (!formData.participantId) {
      onAlert([
        "근태 체크 카드에서 이름과 전화번호 뒷 4자리로 본인 확인을 먼저 완료해주세요.",
      ]);
      return;
    }

    saveToLocalStorage();
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
                onChange={(event) => handleSelectSido(event.target.value)}
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
                onChange={(event) => handleSelectSigungu(event.target.value)}
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
                  handleSelectOrganizationType(event.target.value)
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
                onChange={(event) => handleSelectOrg(event.target.value)}
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
              onChange={(event) => handleSelectProgramType(event.target.value)}
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
              onChange={(event) => handleSelectProgram(event.target.value)}
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
            <label className={labelClass}>
              수요처명
              <small className={labelSmallClass}>서비스대상자명</small>
            </label>
            <input
              className={inputClass}
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
              <label className={labelClass}>참여자 성함</label>
              <input
                className={inputClass}
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
        <button className={btnPrimaryClass} onClick={handleClickNextButton}>
          다음
        </button>
        <button
          className={btnTextClass + " self-center"}
          onClick={saveToLocalStorage}
        >
          나중에 이어서 작성하고 저장만 하기
        </button>
      </BottomBar>
    </div>
  );
};

export default AffiliationInputPage;
