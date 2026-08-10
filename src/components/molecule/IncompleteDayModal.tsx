import { createPortal } from "react-dom";

interface IncompleteDayModalProps {
  date: string;
  onConfirm: () => void;
}

const IncompleteDayModal = ({ date, onConfirm }: IncompleteDayModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icon-signature.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          {date.replaceAll("-", ".")} 활동일지가
          <br />
          아직 완료되지 않았어요
        </div>
        <div className="text-[14px] text-text-muted font-semibold mt-1.5">
          업무일지·안전일지·서명을 다 마쳐야 제출돼요
          <br />
          사업 담당자에게 문의해 주세요
        </div>

        <button
          onClick={onConfirm}
          className="w-full h-[52px] rounded-[14px] bg-brand text-white text-[16px] font-extrabold border-none mt-5 cursor-pointer"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );

export default IncompleteDayModal;
