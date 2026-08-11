import { createPortal } from "react-dom";

import Button from "../atoms/Button";

interface ConfirmModalProps {
  messages?: string[];
  isOpen?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
}

const ConfirmModal = ({ messages, isOpen, onClose, onConfirm }: ConfirmModalProps) => {
  if (!isOpen) return null;

  const hasTitle = (messages?.length ?? 0) > 1;

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(15,23,42,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 pt-7 pb-[22px] w-full max-w-[340px] shadow-[0_12px_32px_rgba(20,30,50,0.24)] text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-tint text-brand text-[26px] font-extrabold flex items-center justify-center mx-auto mb-3.5">
          !
        </div>

        {hasTitle && (
          <div className="text-[16px] font-extrabold text-text-strong mb-3">
            아래 항목을 확인해주세요
          </div>
        )}

        <div className="flex flex-col gap-2 text-left bg-[#f7f9fb] rounded-[14px] px-4 py-3.5">
          {messages?.map((message, index) => (
            <span
              key={index}
              className="text-[14px] font-semibold text-text-tertiary whitespace-pre-wrap break-keep"
            >
              {message}
            </span>
          ))}
        </div>

        <div className="flex flex-row gap-2.5 justify-center mt-5">
          <Button variant="primary" onClick={onConfirm} className="flex-1">
            확인
          </Button>
          <Button variant="outline" onClick={onClose} className="hidden flex-1">
            취소
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmModal;
