import { createPortal } from "react-dom";

interface SosIdentificationRequiredModalProps {
  onConfirm: () => void;
  // 기본정보(이름 등)를 아직 등록 안 했으면 '기본정보 등록'부터, 이미 등록했지만
  // 본인확인만 안 끝났으면 '활동일지 시작'을 눌러야 한다고 다르게 안내한다.
  isBasicInfoRegistered: boolean;
}

const SosIdentificationRequiredModal = ({
  onConfirm,
  isBasicInfoRegistered,
}: SosIdentificationRequiredModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icons/icon-basic-info.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          본인 확인 후 사용할 수 있어요
        </div>
        <div className="text-[14.5px] text-text-tertiary font-semibold leading-[1.6] mt-2.5">
          {isBasicInfoRegistered ? (
            <>
              <span className="font-extrabold">활동일지 시작</span>에서 본인확인을 진행해주세요
            </>
          ) : (
            <>
              <span className="font-extrabold">기본정보 등록</span>부터 진행해주세요
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

export default SosIdentificationRequiredModal;
