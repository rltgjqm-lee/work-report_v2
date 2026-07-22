import { useState } from "react";

import {
  addParticipant,
  bulkAddParticipants,
} from "../../api/admin/participants";
import SlideModal from "../../components/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { btnGhostClass, btnPrimaryClass, inputClass } from "../../uiClasses";
import type { DemandSite, Group } from "../../types";
import { downloadAddParticipantsTemplate } from "../../../utils/downloadAddParticipantsTemplate";
import { parseParticipantsFile } from "../../../utils/parseParticipantsFile";

const emptyForm = {
  name: "",
  lastPhoneNumber: "",
  demandName: "",
  demandSiteId: "",
  groupId: "",
};

interface ParticipantAddModalProps {
  onClose: () => void;
  onSaved: () => void;
  programId: number;
  activeGroups: Group[];
  activeDemandSites: DemandSite[];
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 참여자를 추가하는 모달입니다.
 *
 */
// 부모가 열 때만 이 컴포넌트를 마운트하는 방식(조건부 렌더)이라, 열릴 때마다
// 새로 마운트되면서 초기값이 자연스럽게 적용된다 — 별도 리셋 effect가 필요 없다.
const ParticipantAddModal = ({
  onClose,
  onSaved,
  programId,
  activeGroups,
  activeDemandSites,
}: ParticipantAddModalProps) => {
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleSaveButtonClick = async () => {
    try {
      if (selectedFile) {
        const rows = await parseParticipantsFile(
          selectedFile,
          activeGroups,
          activeDemandSites,
        );
        if (rows.length === 0) {
          alert("파일에서 등록할 참여자를 찾지 못했습니다.");

          return;
        }
        await bulkAddParticipants(programId, { participants: rows });
      } else {
        if (!form.name) {
          alert("이름을 입력해주세요.");

          return;
        }
        if (!/^\d{4}$/.test(form.lastPhoneNumber)) {
          alert("전화번호 뒷 4자리를 숫자 4자리로 입력해주세요.");

          return;
        }
        await addParticipant(programId, {
          name: form.name,
          demandName: form.demandName || undefined,
          demandSiteId: form.demandSiteId
            ? Number(form.demandSiteId)
            : undefined,
          phoneLast4: form.lastPhoneNumber,
          groupId: form.groupId ? Number(form.groupId) : undefined,
        });
      }
      onSaved();
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
          <div className="text-[13px] font-bold text-[#2f5c25]">
            엑셀로 일괄 등록
          </div>
          <div className="text-xs text-[#5c7a53] mt-0.5">
            양식을 내려받아 작성한 뒤 업로드하세요
          </div>
        </div>
        <button
          className={btnGhostClass}
          onClick={() =>
            downloadAddParticipantsTemplate(activeGroups, activeDemandSites)
          }
        >
          양식 다운로드
        </button>
      </div>

      <label
        htmlFor="part-file-input"
        className={`flex flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed rounded-[2px] py-6 px-4 cursor-pointer text-center hover:bg-[#f7f8fa] ${
          selectedFile
            ? "border-[#1e3a5f] bg-[#f5f8fb]"
            : "border-[#c7cdd6] hover:border-[#9aa5b3]"
        }`}
      >
        <input
          id="part-file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <span className="text-lg text-[#6b7280]">⬆</span>
        <span className="text-[13px] font-semibold text-[#374151]">
          {selectedFile ? selectedFile.name : "파일이 선택되지 않았습니다"}
        </span>
        <span className="text-[11.5px] text-[#9aa1ab]">
          {selectedFile
            ? "다른 파일을 선택하려면 다시 클릭하세요"
            : "클릭하여 파일 선택 (xlsx)"}
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
          onChange={(event) =>
            setForm((f) => ({ ...f, name: event.target.value }))
          }
        />
      </FormField>
      <FormField label="수요처명">
        <input
          className={inputClass}
          value={form.demandName}
          onChange={(event) =>
            setForm((f) => ({ ...f, demandName: event.target.value }))
          }
        />
      </FormField>
      <FormField label="전화번호 뒷자리(4자리)">
        <input
          className={inputClass}
          value={form.lastPhoneNumber}
          maxLength={4}
          inputMode="numeric"
          placeholder="0000"
          onChange={(event) =>
            setForm((f) => ({
              ...f,
              lastPhoneNumber: event.target.value
                .replace(/\D/g, "")
                .slice(0, 4),
            }))
          }
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
      <FormField label="수요처 배정">
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
    </SlideModal>
  );
};

export default ParticipantAddModal;
