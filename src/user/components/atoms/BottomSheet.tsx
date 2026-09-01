import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * 참여자 앱 알림/확인 모달의 공통 셸입니다. 화면 아래에서 올라오는 패널 + 반투명
 * 배경으로 구성되며, 배경을 누르면 onClose가 호출됩니다(패널 자체는 클릭이 안까지
 * 전파되지 않도록 막습니다). 큰글씨 모드에서 텍스트가 늘어나도 고정폭 카드처럼
 * 잘리지 않고 패널 높이가 내용만큼 늘어나는 것이 기존 센터 카드 모달과의 차이입니다.
 */
const BottomSheet = ({ onClose, children }: BottomSheetProps) =>
  createPortal(
    <div
      className="fixed inset-0 bg-[rgba(20,30,50,0.45)] z-[9999] flex items-end justify-center animate-sheet-backdrop-in"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[85vh] overflow-y-auto bg-white rounded-t-[24px] px-6 pt-3 shadow-[0_-12px_32px_rgba(20,30,50,0.2)] animate-sheet-slide-up"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-10 h-1.5 rounded-full bg-border-default mx-auto mb-4" />
        {children}
      </div>
    </div>,
    document.body,
  );

export default BottomSheet;
