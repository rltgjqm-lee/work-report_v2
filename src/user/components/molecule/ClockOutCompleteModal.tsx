import { createPortal } from "react-dom";

interface ClockOutCompleteModalProps {
  endTime: string;
  onConfirm: () => void;
  // 퇴근 직후엔 "서명하러 가기"로 바로 전체 확인·서명으로 이어지게 한다(서명을 이미 했으면 "확인")
  confirmLabel?: string;
}

const ClockOutCompleteModal = ({
  endTime,
  onConfirm,
  confirmLabel = "확인",
}: ClockOutCompleteModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icons/icon-checkout-clock.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          {endTime}에 정상적으로
          <br />
          퇴근 완료했어요
        </div>
        <div className="text-[14px] text-text-muted font-semibold mt-1.5">오늘도 수고하셨어요</div>

        <button
          onClick={onConfirm}
          className="w-full h-[52px] rounded-[14px] bg-brand text-white text-[16px] font-extrabold border-none mt-5 cursor-pointer"
        >
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body,
  );

export default ClockOutCompleteModal;
