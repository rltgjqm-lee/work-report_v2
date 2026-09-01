import BottomSheet from "../atoms/BottomSheet";

interface ActivitySaveConfirmModalLargeFontProps {
  actContent: string;
  actPlace: string;
  onConfirm: () => void;
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-3 border-b border-border-faint last:border-b-0">
    <span className="text-[15px] text-text-subtitle font-semibold flex-none">{label}</span>
    <span className="text-[17px] font-extrabold text-text-strong text-right">{value}</span>
  </div>
);

const ActivitySaveConfirmModalLargeFont = ({
  actContent,
  actPlace,
  onConfirm,
}: ActivitySaveConfirmModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-task.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        활동일지를 저장했어요
      </div>
      <div className="bg-[#f7f9fb] rounded-[14px] px-4 mt-2">
        <InfoRow label="활동내용" value={actContent} />
        <InfoRow label="활동장소" value={actPlace} />
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

export default ActivitySaveConfirmModalLargeFont;
