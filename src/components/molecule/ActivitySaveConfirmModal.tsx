import { createPortal } from "react-dom";

interface ActivitySaveConfirmModalProps {
  actContent: string;
  actPlace: string;
  onConfirm: () => void;
}

const ActivitySaveConfirmModal = ({
  actContent,
  actPlace,
  onConfirm,
}: ActivitySaveConfirmModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icon-task.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          오늘 활동내역은 <b>{actContent}</b>이고
          <br />
          활동장소는 <b>{actPlace}</b>이에요
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

export default ActivitySaveConfirmModal;
