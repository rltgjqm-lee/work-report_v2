import { createPortal } from "react-dom";

import Button from "../atoms/Button";

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
    <div className="fixed inset-0 w-full h-full bg-[rgba(15,23,42,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 pt-7 pb-[22px] w-full max-w-[340px] shadow-[0_12px_32px_rgba(20,30,50,0.24)]">
        <p className="text-[18px] font-semibold text-[#1f2937] leading-[1.5]">
          {hasAccident ? (
            <>
              사고내용은 <b className="text-[#3182f6]">{accidentDetail}</b>이고
              <br />
              사고 후에는 <b className="text-[#3182f6]">{accidentAction}</b>하셨어요
            </>
          ) : (
            <>
              오늘도 <b className="text-[#3182f6]">안전</b>하게 마감했어요
            </>
          )}
        </p>

        <Button variant="primary" onClick={onConfirm} className="w-full mt-5">
          확인
        </Button>
      </div>
    </div>,
    document.body,
  );

export default SafetySaveConfirmModal;
