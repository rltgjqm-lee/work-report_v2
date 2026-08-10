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

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(15,23,42,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 pt-7 pb-[22px] w-full max-w-[340px] shadow-[0_12px_32px_rgba(20,30,50,0.24)]">
        <div className="text-[18px] font-extrabold text-text-strong leading-[1.5] whitespace-pre-wrap break-keep text-left">
          {messages?.map((message, index) => (
            <p key={index} className="mb-1 last:mb-0">
              {message}
            </p>
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
