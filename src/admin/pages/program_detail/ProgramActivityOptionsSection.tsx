import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProgramActivityOptionMutationOptions,
  deleteProgramActivityOptionMutationOptions,
  programActivityOptionsQueryOptions,
  type ActivityOptionCategory,
  type ProgramActivityOption,
} from "../../api/admin/programActivityOptions";
import { useToast } from "../../context/useToast";

import Button from "../../components/Button";
import Input from "../../components/Input";
import ItemCard from "../../components/ItemCard";

interface ProgramActivityOptionsSectionProps {
  programId: number;
}

interface OptionListProps {
  title: string;
  options: ProgramActivityOption[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAddButtonClick: () => void;
  onDeleteButtonClick: (option: ProgramActivityOption) => void;
}

const OptionList = ({
  title,
  options,
  inputValue,
  onInputChange,
  onAddButtonClick,
  onDeleteButtonClick,
}: OptionListProps) => (
  <div className="bg-white border border-admin-border-subtle rounded-[2px]">
    <div className="px-5 py-4 border-b border-border-faint">
      <span className="text-sm font-bold">{title}</span>
      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 min-w-0">
          <Input
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAddButtonClick();
            }}
            placeholder="항목명을 입력하세요"
          />
        </div>
        <Button variant="ghost" onClick={onAddButtonClick}>
          + 추가
        </Button>
      </div>
    </div>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 px-5 py-4">
      {options.length === 0 && (
        <span className="text-[13px] text-admin-text-placeholder">등록된 항목이 없습니다.</span>
      )}
      {options.map((option) => (
        <ItemCard
          key={option.id}
          title={option.label}
          infoLine={null}
          actions={[{ label: "삭제", onClick: () => onDeleteButtonClick(option) }]}
        />
      ))}
    </div>
  </div>
);

/**
 * 관리자 페이지 > 사업단 상세 페이지의 업무일지 항목(활동내용/활동장소 드롭다운 선택지)
 * 관리 섹션입니다. 참여자 앱은 여기서 등록한 항목만 셀렉트로 보여주고, 없으면 "기타"로
 * 직접 입력합니다.
 */
const ProgramActivityOptionsSection = ({ programId }: ProgramActivityOptionsSectionProps) => {
  const [contentLabel, setContentLabel] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: options = [] } = useQuery(programActivityOptionsQueryOptions(programId));
  const createOptionMutation = useMutation(createProgramActivityOptionMutationOptions(queryClient));
  const deleteOptionMutation = useMutation(deleteProgramActivityOptionMutationOptions(queryClient));

  const contentOptions = useMemo(
    () => options.filter((option) => option.category === "CONTENT"),
    [options],
  );
  const placeOptions = useMemo(
    () => options.filter((option) => option.category === "PLACE"),
    [options],
  );

  const addOption = (category: ActivityOptionCategory, label: string, onDone: () => void) => {
    if (!label.trim()) return;

    createOptionMutation.mutate(
      { programId, category, label: label.trim() },
      {
        onSuccess: () => {
          showToast(`'${label.trim()}' 항목을 추가했습니다.`);
          onDone();
        },
        onError: (error) => alert(error instanceof Error ? error.message : "추가에 실패했습니다."),
      },
    );
  };

  const handleAddContentOptionButtonClick = () => {
    addOption("CONTENT", contentLabel, () => setContentLabel(""));
  };

  const handleAddPlaceOptionButtonClick = () => {
    addOption("PLACE", placeLabel, () => setPlaceLabel(""));
  };

  const handleDeleteOptionButtonClick = (option: ProgramActivityOption) => {
    if (!confirm(`'${option.label}' 항목을 삭제하시겠습니까?`)) return;

    deleteOptionMutation.mutate(
      { id: option.id, programId },
      {
        onSuccess: () => showToast(`'${option.label}' 항목을 삭제했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
      },
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <OptionList
        title="활동내용 항목"
        options={contentOptions}
        inputValue={contentLabel}
        onInputChange={setContentLabel}
        onAddButtonClick={handleAddContentOptionButtonClick}
        onDeleteButtonClick={handleDeleteOptionButtonClick}
      />
      <OptionList
        title="활동장소 항목"
        options={placeOptions}
        inputValue={placeLabel}
        onInputChange={setPlaceLabel}
        onAddButtonClick={handleAddPlaceOptionButtonClick}
        onDeleteButtonClick={handleDeleteOptionButtonClick}
      />
    </div>
  );
};

export default ProgramActivityOptionsSection;
