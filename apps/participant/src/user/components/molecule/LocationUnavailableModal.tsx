import { createPortal } from "react-dom";

interface LocationUnavailableModalProps {
  onConfirm: () => void;
}

const LocationUnavailableModal = ({ onConfirm }: LocationUnavailableModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icons/icon-map.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          위치를 확인하지 못했어요
        </div>
        <div className="text-[14.5px] text-text-tertiary font-semibold leading-[1.6] mt-2.5">
          잠시 후 출근 버튼을 다시 눌러주세요
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

export default LocationUnavailableModal;
