import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  addParticipantMutationOptions,
  bulkAddParticipantsMutationOptions,
} from "../../api/admin/participants";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { DemandSite, Group } from "../../types";
import { downloadAddParticipantsTemplate } from "../../../utils/downloadAddParticipantsTemplate";
import { parseParticipantsFile } from "../../../utils/parseParticipantsFile";

const emptyForm = {
  name: "",
  demandSiteId: "",
  groupId: "",
};

interface ParticipantAddModalProps {
  onClose: () => void;
  programId: number;
  activeGroups: Group[];
  activeDemandSites: DemandSite[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 참여자를 추가하는 모달입니다.
 *
 */
const ParticipantAddModal = ({
  onClose,
  programId,
  activeGroups,
  activeDemandSites,
}: ParticipantAddModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const queryClient = useQueryClient();
  const addParticipantMutation = useMutation(addParticipantMutationOptions(queryClient));
  const bulkAddParticipantsMutation = useMutation(bulkAddParticipantsMutationOptions(queryClient));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleSaveButtonClick = async () => {
    try {
      if (selectedFile) {
        const rows = await parseParticipantsFile(selectedFile, activeGroups, activeDemandSites);
        if (rows.length === 0) {
          alert("파일에서 등록할 참여자를 찾지 못했습니다.");

          return;
        }
        await bulkAddParticipantsMutation.mutateAsync({
          programId,
          data: { participants: rows },
        });
      } else {
        if (!form.name) {
          alert("이름을 입력해주세요.");

          return;
        }
        await addParticipantMutation.mutateAsync({
          programId,
          data: {
            name: form.name,
            demandSiteId: form.demandSiteId ? Number(form.demandSiteId) : undefined,
            groupId: form.groupId ? Number(form.groupId) : undefined,
          },
        });
      }
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <SlideModal
      isOpen
      title="참여자 추가"
      onClose={onClose}
      footer={
        <>
          <button className={btnGhostClass} onClick={onClose}>
            취소
          </button>
          <button className={btnPrimaryClass} onClick={handleSaveButtonClick}>
            저장
          </button>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 bg-[#f0f6ee] border border-[#d3e6cc] rounded-[2px] px-4 py-3.5">
        <div>
          <div className="text-[13px] font-bold text-[#2f5c25]">엑셀로 일괄 등록</div>
          <div className="text-xs text-[#5c7a53] mt-0.5">
            양식을 내려받아 작성한 뒤 업로드하세요
          </div>
        </div>
        <button
          className={btnGhostClass}
          onClick={() => downloadAddParticipantsTemplate(activeGroups, activeDemandSites)}
        >
          양식 다운로드
        </button>
      </div>

      <label
        htmlFor="part-file-input"
        className={`flex flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed rounded-[2px] py-6 px-4 cursor-pointer text-center hover:bg-[#f7f8fa] ${
          selectedFile ? "border-[#1e3a5f] bg-[#f5f8fb]" : "border-[#c7cdd6] hover:border-[#9aa5b3]"
        }`}
      >
        <input
          id="part-file-input"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        <span className="text-lg text-[#6b7280]">⬆</span>
        <span className="text-[13px] font-semibold text-[#374151]">
          {selectedFile ? selectedFile.name : "파일이 선택되지 않았습니다"}
        </span>
        <span className="text-[11.5px] text-[#9aa1ab]">
          {selectedFile ? "다른 파일을 선택하려면 다시 클릭하세요" : "클릭하여 파일 선택 (xlsx)"}
        </span>
      </label>

      <div className="flex items-center gap-2.5 text-[#9aa1ab] text-[11.5px]">
        <div className="flex-1 h-px bg-[#e2e5eb]" />
        <span>또는 직접 입력</span>
        <div className="flex-1 h-px bg-[#e2e5eb]" />
      </div>

      <FormField label="이름">
        <input
          className={inputClass}
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
        <p className="text-[11.5px] text-[#9aa1ab] mt-1.5">
          동명이인이 있으면 이름 뒤에 숫자를 붙여 구분해주세요
          <br />
          (예: 홍길동1, 홍길동2).
        </p>
      </FormField>
      <FormField label="수요처">
        <FilterSelect
          className="w-full"
          value={form.demandSiteId}
          onChange={(value) => setForm((f) => ({ ...f, demandSiteId: value }))}
          options={[
            { value: "", label: "미배정" },
            ...activeDemandSites.map((demandSite) => ({
              value: String(demandSite.id),
              label: demandSite.name,
            })),
          ]}
        />
      </FormField>
      <FormField label="조">
        <FilterSelect
          className="w-full"
          value={form.groupId}
          onChange={(value) => setForm((f) => ({ ...f, groupId: value }))}
          options={[
            { value: "", label: "미배정" },
            ...activeGroups.map((group) => ({
              value: String(group.id),
              label: group.name,
            })),
          ]}
        />
      </FormField>
    </SlideModal>
  );
};

export default ParticipantAddModal;
