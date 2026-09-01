import { createPortal } from "react-dom";

interface ActivitySaveConfirmModalProps {
  actContent: string;
  actPlace: string;
  onConfirm: () => void;
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border-faint last:border-b-0">
    <span className="text-[13px] text-text-subtitle font-semibold flex-none">{label}</span>
    <span className="text-[14.5px] font-extrabold text-text-strong text-right">{value}</span>
  </div>
);

const ActivitySaveConfirmModal = ({
  actContent,
  actPlace,
  onConfirm,
}: ActivitySaveConfirmModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icons/icon-task.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          활동일지를 저장했어요
        </div>
        <div className="bg-[#f7f9fb] rounded-[14px] px-4 mt-2.5">
          <InfoRow label="활동내용" value={actContent} />
          <InfoRow label="활동장소" value={actPlace} />
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
