import { useEffect, useMemo, useState } from "react";

import AttendanceCheckIn from "../../components/molecule/AttendanceCheckIn";
import AppBar from "../../components/appshell/AppBar";
import ProgressBar from "../../components/appshell/ProgressBar";
import Card from "../../components/appshell/Card";
import BottomBar from "../../components/appshell/BottomBar";
import {
  pageClass,
  bodyClass,
  labelClass,
  labelSmallClass,
  inputClass,
  selectClass,
  btnPrimaryClass,
  btnTextClass,
} from "../../components/appshell/classes";
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
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [programs, setPrograms] = useState<PublicProgram[]>([]);

  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [agencyType, setAgencyType] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [projectType, setProjectType] = useState("");
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
    if (!selectedOrgId) return;
    listPublicPrograms(Number(selectedOrgId))
      .then(setPrograms)
      .catch(() => onAlert(["사업단 목록을 불러오지 못했습니다."]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  const sidoList = useMemo(
    () =>
      Array.from(
        new Set(organizations.map((o) => o.regionSido).filter(Boolean)),
      ) as string[],
    [organizations],
  );

  const sigunguList = useMemo(
    () =>
      Array.from(
        new Set(
          organizations
            .filter((o) => o.regionSido === sido)
            .map((o) => o.regionSigungu)
            .filter(Boolean),
        ),
      ) as string[],
    [organizations, sido],
  );

  const agencyTypeList = useMemo(
    () =>
      Array.from(
        new Set(
          organizations
            .filter((o) => o.regionSido === sido && o.regionSigungu === sigungu)
            .map((o) => o.agencyType)
            .filter(Boolean),
        ),
      ) as string[],
    [organizations, sido, sigungu],
  );

  const orgCandidates = useMemo(
    () =>
      organizations.filter(
        (o) =>
          o.regionSido === sido &&
          o.regionSigungu === sigungu &&
          o.agencyType === agencyType,
      ),
    [organizations, sido, sigungu, agencyType],
  );

  const projectTypeList = useMemo(
    () =>
      Array.from(
        new Set(programs.map((p) => p.projectType).filter(Boolean)),
      ) as string[],
    [programs],
  );

  const programCandidates = useMemo(
    () => programs.filter((p) => p.projectType === projectType),
    [programs, projectType],
  );

  const handleSelectSido = (value: string) => {
    setSido(value);
    setSigungu("");
    setAgencyType("");
    setSelectedOrgId("");
    setPrograms([]);
    setProjectType("");
    setSelectedProgramId("");
  };

  const handleSelectSigungu = (value: string) => {
    setSigungu(value);
    setAgencyType("");
    setSelectedOrgId("");
    setPrograms([]);
    setProjectType("");
    setSelectedProgramId("");
  };

  const handleSelectAgencyType = (value: string) => {
    setAgencyType(value);
    setSelectedOrgId("");
    setPrograms([]);
    setProjectType("");
    setSelectedProgramId("");
  };

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    setProjectType("");
    setSelectedProgramId("");
    onChange(
      "orgName",
      organizations.find((o) => String(o.id) === orgId)?.name ?? "",
    );
    onChange("projectName", "");
  };

  const handleSelectProjectType = (value: string) => {
    setProjectType(value);
    setSelectedProgramId("");
    onChange("projectName", "");
  };

  const handleSelectProgram = (programId: string) => {
    setSelectedProgramId(programId);
    onChange(
      "projectName",
      programs.find((p) => String(p.id) === programId)?.name ?? "",
    );
  };

  const saveToLocalStorage = () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CONF_ORG, formData.orgName);
    localStorage.setItem(LOCAL_STORAGE_KEYS.CONF_PROJ, formData.projectName);
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

    saveToLocalStorage();
    onNext();
  };

  return (
    <div className={pageClass}>
      <AppBar title="기본정보" />
      <ProgressBar step={1} />
      <div className={bodyClass}>
        <Card>
          <div className="flex gap-3.5">
            <div className="flex-1">
              <label className={labelClass}>시·도</label>
              <select
                className={selectClass + " w-full"}
                value={sido}
                onChange={(e) => handleSelectSido(e.target.value)}
              >
                <option value="">선택하세요</option>
                {sidoList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>시·군·구</label>
              <select
                className={selectClass + " w-full"}
                value={sigungu}
                disabled={!sido}
                onChange={(e) => handleSelectSigungu(e.target.value)}
              >
                <option value="">선택하세요</option>
                {sigunguList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3.5">
            <div className="flex-1">
              <label className={labelClass}>기관 유형</label>
              <select
                className={selectClass + " w-full"}
                value={agencyType}
                disabled={!sigungu}
                onChange={(e) => handleSelectAgencyType(e.target.value)}
              >
                <option value="">선택하세요</option>
                {agencyTypeList.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>소속 기관명</label>
              <select
                className={selectClass + " w-full"}
                value={selectedOrgId}
                disabled={!agencyType}
                onChange={(e) => handleSelectOrg(e.target.value)}
              >
                <option value="">선택하세요</option>
                {orgCandidates.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>사업 유형</label>
            <select
              className={selectClass + " w-full"}
              value={projectType}
              disabled={!selectedOrgId}
              onChange={(e) => handleSelectProjectType(e.target.value)}
            >
              <option value="">선택하세요</option>
              {projectTypeList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>사업단명</label>
            <select
              className={selectClass + " w-full"}
              value={selectedProgramId}
              disabled={!projectType}
              onChange={(e) => handleSelectProgram(e.target.value)}
            >
              <option value="">선택하세요</option>
              {programCandidates.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              수요처명
              <small className={labelSmallClass}>서비스대상자명</small>
            </label>
            <input
              className={inputClass}
              placeholder="예) 00주민센터"
              value={formData.demandName}
              onChange={(e) => onChange("demandName", e.target.value)}
            />
          </div>

          <div className="flex gap-3.5">
            <div className="flex-1">
              <label className={labelClass}>성별</label>
              <select
                className={selectClass + " w-full"}
                value={formData.gender}
                onChange={(e) =>
                  onChange(
                    "gender",
                    e.target.value as ActivityLogFormData["gender"],
                  )
                }
              >
                <option value="">선택하세요</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>참여자 성함</label>
              <input
                className={inputClass}
                placeholder="성함 입력"
                value={formData.userName}
                onChange={(e) => onChange("userName", e.target.value)}
              />
            </div>
          </div>
        </Card>

        {selectedProgramId && (
          <Card>
            <AttendanceCheckIn programId={Number(selectedProgramId)} />
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
