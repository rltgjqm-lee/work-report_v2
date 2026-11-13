import BottomSheet from "../atoms/BottomSheet";

interface IncompleteDayModalLargeFontProps {
  onConfirm: () => void;
}

const IncompleteDayModalLargeFont = ({ onConfirm }: IncompleteDayModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-signature.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        활동일지가
        <br />
        아직 완료되지 않았어요
      </div>
      <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6] mt-2">
        업무일지·안전일지·서명을 다 마쳐야 제출돼요
        <br />
        사업 담당자에게 문의해 주세요
      </div>

      <button
        onClick={onConfirm}
        className="w-full h-[56px] rounded-[16px] bg-brand text-white text-[18px] font-extrabold border-none mt-6 cursor-pointer"
      >
        확인
      </button>
    </div>
  </BottomSheet>
);

export default IncompleteDayModalLargeFont;
