import { createPortal } from "react-dom";

interface SafetySaveConfirmModalProps {
  hasAccident: boolean;
  accidentDetail: string;
  accidentAction: string;
  onConfirm: () => void;
}

const SafetySaveConfirmModal = ({
  hasAccident,
  accidentDetail,
  accidentAction,
  onConfirm,
}: SafetySaveConfirmModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icon-safety.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          {hasAccident ? (
            <>
              사고내용은 <b>{accidentDetail}</b>이고
              <br />
              사고 후에는 <b>{accidentAction}</b>하셨어요
            </>
          ) : (
            <>
              오늘도 <b>안전</b>하게 마감했어요
            </>
          )}
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

export default SafetySaveConfirmModal;
