import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  addParticipantMutationOptions,
  bulkAddParticipantsMutationOptions,
} from "../../api/admin/participants";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import FilterSelect from "../../components/FilterSelect";
import { useToast } from "../../context/useToast";
import Button from "../../components/Button";
import Input from "../../components/Input";
import type { DemandSite, Group } from "../../types";
import { downloadAddParticipantsTemplate } from "../../../utils/excel/downloadAddParticipantsTemplate";
import { parseParticipantsFile } from "../../../utils/excel/parseParticipantsFile";

const GENDER_OPTIONS = [
  { value: "", label: "선택하세요" },
  { value: "남성", label: "남성" },
  { value: "여성", label: "여성" },
];

const emptyForm = {
  name: "",
  gender: "",
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
  const { showToast } = useToast();
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
        const missingGenderNames = rows.filter((row) => !row.gender).map((row) => row.name);
        if (missingGenderNames.length > 0) {
          alert(
            `성별을 입력하지 않았거나 잘못 입력한 참여자가 있습니다: ${missingGenderNames.join(", ")}`,
          );

          return;
        }
        const missingDemandSiteNames = rows
          .filter((row) => !row.demandSiteId)
          .map((row) => row.name);
        if (missingDemandSiteNames.length > 0) {
          alert(
            `수요처를 입력하지 않았거나 잘못 입력한 참여자가 있습니다: ${missingDemandSiteNames.join(", ")}`,
          );

          return;
        }
        const missingGroupNames = rows.filter((row) => !row.groupId).map((row) => row.name);
        if (missingGroupNames.length > 0) {
          alert(
            `조를 입력하지 않았거나 잘못 입력한 참여자가 있습니다: ${missingGroupNames.join(", ")}`,
          );

          return;
        }
        await bulkAddParticipantsMutation.mutateAsync({
          programId,
          // 💡 바로 위에서 성별 누락 행이 없는지 이미 검증했으니 단언해도 안전하다
          data: { participants: rows.map((row) => ({ ...row, gender: row.gender! })) },
        });
        showToast(`참여자 ${rows.length}명을 일괄 등록했습니다.`);
      } else {
        if (!form.name) {
          alert("이름을 입력해주세요.");

          return;
        }
        if (!form.gender) {
          alert("성별을 선택해주세요.");

          return;
        }
        if (!form.demandSiteId) {
          alert("수요처를 선택해주세요.");

          return;
        }
        if (!form.groupId) {
          alert("조를 선택해주세요.");

          return;
        }
        await addParticipantMutation.mutateAsync({
          programId,
          data: {
            name: form.name,
            gender: form.gender as "남성" | "여성",
            demandSiteId: form.demandSiteId ? Number(form.demandSiteId) : undefined,
            groupId: form.groupId ? Number(form.groupId) : undefined,
          },
        });
        showToast(`'${form.name}' 님을 참여자로 등록했습니다.`);
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
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSaveButtonClick}>저장</Button>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 bg-admin-upload-success-bg border border-admin-upload-success-border rounded-[2px] px-4 py-3.5">
        <div>
          <div className="text-[13px] font-bold text-admin-upload-success-text">
            엑셀로 일괄 등록
          </div>
          <div className="text-xs text-admin-upload-success-text-muted mt-0.5">
            양식을 내려받아 작성한 뒤 업로드하세요
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => downloadAddParticipantsTemplate(activeGroups, activeDemandSites)}
        >
          양식 다운로드
        </Button>
      </div>

      <label
        htmlFor="part-file-input"
        className={`flex flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed rounded-[2px] py-6 px-4 cursor-pointer text-center hover:bg-admin-surface-header ${
          selectedFile
            ? "border-admin-brand bg-admin-selected-tint"
            : "border-admin-border-hover hover:border-admin-border-hover-strong"
        }`}
      >
        <input
          id="part-file-input"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        <span className="text-lg text-text-subtle">⬆</span>
        <span className="text-[13px] font-semibold text-admin-text-secondary">
          {selectedFile ? selectedFile.name : "파일이 선택되지 않았습니다"}
        </span>
        <span className="text-[11.5px] text-admin-text-placeholder">
          {selectedFile ? "다른 파일을 선택하려면 다시 클릭하세요" : "클릭하여 파일 선택 (xlsx)"}
        </span>
      </label>

      <div className="flex items-center gap-2.5 text-admin-text-placeholder text-[11.5px]">
        <div className="flex-1 h-px bg-admin-border-subtle" />
        <span>또는 직접 입력</span>
        <div className="flex-1 h-px bg-admin-border-subtle" />
      </div>

      <FormField label="이름">
        <Input
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
        <p className="text-[11.5px] text-admin-text-placeholder mt-1.5">
          동명이인이 있으면 이름 뒤에 숫자를 붙여 구분해주세요
          <br />
          (예: 홍길동1, 홍길동2).
        </p>
      </FormField>
      <FormField label="성별">
        <FilterSelect
          className="w-full"
          value={form.gender}
          onChange={(value) => setForm((f) => ({ ...f, gender: value }))}
          options={GENDER_OPTIONS}
        />
      </FormField>
      <FormField label="수요처">
        <FilterSelect
          className="w-full"
          value={form.demandSiteId}
          onChange={(value) => setForm((f) => ({ ...f, demandSiteId: value }))}
          options={[
            { value: "", label: "선택하세요" },
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
            { value: "", label: "선택하세요" },
            ...activeGroups.map((group) => ({
              value: String(group.id),
              label: group.name,
            })),
          ]}
        />
        <p className="text-[11.5px] text-admin-text-placeholder mt-1.5">
          선택한 수요처에 배정된 조여야 저장됩니다. 조는 나중에 다시 수정할 수 있어요.
        </p>
      </FormField>
    </SlideModal>
  );
};

export default ParticipantAddModal;
