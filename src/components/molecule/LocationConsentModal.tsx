import { createPortal } from "react-dom";

interface LocationConsentModalProps {
  onConfirm: () => void;
}

const LocationConsentModal = ({ onConfirm }: LocationConsentModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icon-map.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          근무 중 위치가 확인돼요
        </div>
        <div className="text-[14.5px] text-text-tertiary font-semibold leading-[1.6] mt-2.5">
          출근하면 근무지 확인과 근무 중 안전 관리를
          <br />
          위해 위치를 주기적으로 확인해요
          <br />
          퇴근을 등록하면 위치 확인이 즉시 중단돼요
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

export default LocationConsentModal;
