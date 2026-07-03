// src/components/organisms/ConfirmModal.tsx

import { createPortal } from "react-dom";

interface ConfirmModalProps {
  messages: string[];
  isOpen?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
}

const ConfirmModal = ({
  messages,
  isOpen,
  onClose,
  onConfirm,
}: ConfirmModalProps) => {
  if (!isOpen) return null;

  // 완전히 독립된 최상단 레이어로 모달을 쏘아 올립니다.
  return createPortal(
    <div
      id="customModal"
      className="hidden fixed top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.5)] z-[9999] justify-center items-center"
    >
      <div className="bg-white p-[30px] rounded-xl max-w-[400px] w-4/5 shadow-[0_10px_25px_rgba(0,0,0,0.2)]">
        <div
          id="modalMessage"
          className="text-[18px] mb-[25px] leading-normal whitespace-pre-wrap text-left text-[#2c3e50]"
        >
          {messages.map((message) => message)}
        </div>

        <div id="modalButtons" className="flex flex-row gap-2.5 justify-center">
          <button
            id="modalBtnOk"
            className="flex-1 p-[14px] text-[16px] font-bold font-sans rounded-xl cursor-pointer border-none bg-[#00a0e9] text-white"
            onClick={onConfirm}
          >
            확인
          </button>
          <button
            id="modalBtnCancel"
            className="hidden flex-1 p-[14px] text-[16px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222]"
            onClick={onClose}
          >
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body, // body 바로 밑에 생성되므로 z-index 싸움을 할 필요가 없어짐!
  );
};

export default ConfirmModal;
