import { useEffect, useState } from "react";

import Button from "../../components/atoms/Button";
import LabeledInput from "../../components/molecule/LabeledInput";
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

const selectClassName =
  "w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border bg-white max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]";

/**
 * Page 1: 사용자 정보 입력
 */
const Page1OnConfig = ({
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
  const [selectedOrgId, setSelectedOrgId] = useState("");
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

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedProgramId("");
    setPrograms([]);
    onChange(
      "orgName",
      organizations.find((o) => String(o.id) === orgId)?.name ?? "",
    );
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

  const handleClickSaveButton = () => {
    const errors = validateForm(formData, PAGE1_RULES);

    if (errors.length > 0) {
      onAlert(errors);
      return;
    }
    saveToLocalStorage();

    onAlert(["기관 정보가 안전하게 저장되었습니다."]);
  };

  const handleClickNextButton = () => {
    const errors = validateForm(formData, PAGE1_RULES);

    const successConfirmMessage = [
      "✅ 기관 정보가 안전하게 저장되었습니다.",
      "--------------------------------------",
      `• 기관명: [${formData.orgName}]`,
      `• 참여사업명: [${formData.projectName}]`,
      `• 참여자 성명: [${formData.userName}]`,
      `• 수요처명: [${formData.demandName}]`,
      "--------------------------------------",
      "다음 페이지로  이동합니다.",
    ];

    if (errors.length > 0) {
      onAlert(errors);

      return;
    }

    saveToLocalStorage();

    // 윈도우 기본 confirm 창 사용 (나중에 만든 ConfirmModal 연동 가능)
    onAlert(successConfirmMessage);
    onNext();
  };

  return (
    <div
      className="p-[30px_20px] flex-1 flex flex-col max-[600px]:p-[20px_15px]"
      id="page1"
    >
      <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left whitespace-nowrap tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
        노인공익활동사업 활동일지
      </div>

      {/* 기관명 선택 */}
      <div className="flex flex-col items-start mb-[25px] gap-2 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          기관명
        </div>
        <select
          className={selectClassName}
          value={selectedOrgId}
          onChange={(e) => handleSelectOrg(e.target.value)}
        >
          <option value="">선택하세요</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      {/* 참여사업명 선택*/}
      <div className="flex flex-col items-start mb-[25px] gap-2 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          참여사업명
        </div>
        <select
          className={selectClassName}
          value={selectedProgramId}
          disabled={!selectedOrgId}
          onChange={(e) => handleSelectProgram(e.target.value)}
        >
          <option value="">선택하세요</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
      </div>

      {/* 수요처명 입력*/}
      <div className="flex flex-col items-start mb-[25px] gap-2 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <LabeledInput
          labelTitle={
            <>
              수요처명 <br />
              <span className="text-[14px] font-normal">(서비스대상자명)</span>
            </>
          }
          id="demandName"
          placeholder="예) 00주민센터"
          value={formData.demandName}
          onChange={(e) => onChange("demandName", e.target.value)}
        />
      </div>

      {/* 참여자명 입력*/}
      <div className="flex flex-col items-start mb-[25px] gap-2 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <LabeledInput
          labelTitle="참여자 성명"
          id="userName"
          placeholder="성함 입력"
          value={formData.userName}
          onChange={(e) => onChange("userName", e.target.value)}
        />
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-center gap-4 pt-5 max-[600px]:pt-3">
        <Button variant="blue" onClick={handleClickSaveButton}>
          저장하기
        </Button>
        <Button variant="white" onClick={handleClickNextButton}>
          다음
        </Button>
      </div>
    </div>
  );
};

export default Page1OnConfig;
