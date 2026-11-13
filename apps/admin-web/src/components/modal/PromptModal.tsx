import { useState } from "react";

import Button from "../Button";
import Input from "../Input";

interface PromptModalProps {
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * 브라우저 기본 prompt()를 대체하는 중앙 모달 — 사유/메모처럼 한 줄 텍스트를
 * 입력받고 확인/취소로 응답을 돌려준다. 취소 시 값 없이 onCancel만 호출한다.
 * (수요처 배정 모달 등에서 쓰는 중앙 모달 스타일을 그대로 따른다.)
 */
const PromptModal = ({
  title,
  placeholder,
  confirmLabel = "확인",
  onConfirm,
  onCancel,
}: PromptModalProps) => {
  const [value, setValue] = useState("");

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,32,0.45)] z-[2000] flex items-center justify-center">
      <div className="bg-white rounded-[8px] shadow-xl w-[380px] p-5">
        <div className="text-[14px] font-bold mb-4">{title}</div>

        <Input
          type="text"
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onConfirm(value);
          }}
        />

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button onClick={() => onConfirm(value)}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};

export default PromptModal;
