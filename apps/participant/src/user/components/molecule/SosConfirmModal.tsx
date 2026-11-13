import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface SosConfirmModalProps {
  onSend: () => void;
  onCancel: () => void;
}

// 취소를 안 누르면 이 시간 뒤 자동 전송 — 쓰러지는 등 더 조작할 수 없는 상황에서도
// 기본 동작이 "전송"이 되도록, 확인이 아니라 취소를 받는 구조로 둔다.
const COUNTDOWN_SECONDS = 10;

const SosConfirmModal = ({ onSend, onCancel }: SosConfirmModalProps) => {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onSend();
      return;
    }
    const timeoutId = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [secondsLeft, onSend]);

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <div className="text-[17px] font-extrabold text-text-strong">🚨 SOS 전송</div>
        <div className="text-[14px] text-text-strong font-semibold mt-2 leading-[1.5]">
          잠시 후 관리자와 동료에게
          <br />
          긴급 알림이 전송됩니다
        </div>
        <div className="text-[48px] font-extrabold text-danger-strong my-4">{secondsLeft}</div>
        <button
          onClick={onCancel}
          className="w-full h-[52px] rounded-[14px] bg-surface-page text-text-strong text-[16px] font-extrabold border-none cursor-pointer"
        >
          취소
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default SosConfirmModal;
