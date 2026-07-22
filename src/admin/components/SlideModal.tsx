import type { ReactNode } from "react";

interface SlideModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * 우측에서 슬라이드로 나타나는 모달의 공통 레이아웃(제목/본문/푸터)입니다.
 *
 */
const SlideModal = ({
  isOpen,
  title,
  onClose,
  children,
  footer,
}: SlideModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,32,0.45)] flex justify-end z-50">
      <div className="w-[440px] max-w-[90vw] h-full bg-white flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.14)]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#eceef1]">
          <span className="text-[15px] font-bold">{title}</span>
          <button
            onClick={onClose}
            className="border-none bg-transparent text-xl text-[#6b7280] cursor-pointer leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5 flex flex-col gap-4">
          {children}
        </div>
        <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-[#eceef1]">
          {footer}
        </div>
      </div>
    </div>
  );
};

export default SlideModal;
