import BottomSheet from "../atoms/BottomSheet";

interface ClockOutCompleteModalLargeFontProps {
  endTime: string;
  onConfirm: () => void;
  // 퇴근 직후엔 "서명하러 가기"로 바로 전체 확인·서명으로 이어지게 한다(서명을 이미 했으면 "확인")
  confirmLabel?: string;
  // 바깥을 눌러 닫을 때 — 버튼(onConfirm)과 달리 서명 화면으로 넘어가지 않고 닫기만 한다
  onClose?: () => void;
}

const ClockOutCompleteModalLargeFont = ({
  endTime,
  onConfirm,
  confirmLabel = "확인",
  onClose,
}: ClockOutCompleteModalLargeFontProps) => (
  <BottomSheet onClose={onClose ?? onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-checkout-clock.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        {endTime}에 정상적으로
        <br />
        퇴근 완료했어요
      </div>
      <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6] mt-2">
        오늘도 수고하셨어요
      </div>

      <button
        onClick={onConfirm}
        className="w-full h-[56px] rounded-[16px] bg-brand text-white text-[18px] font-extrabold border-none mt-6 cursor-pointer"
      >
        {confirmLabel}
      </button>
    </div>
  </BottomSheet>
);

export default ClockOutCompleteModalLargeFont;
