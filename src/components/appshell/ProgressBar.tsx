interface ProgressBarProps {
  step: number;
  total?: number;
}

const ProgressBar = ({ step, total = 5 }: ProgressBarProps) => (
  <>
    <div className="h-1.5 bg-[#eef0f3] flex-none">
      <div
        className="h-1.5 bg-[#3182f6]"
        style={{ width: `${(step / total) * 100}%` }}
      />
    </div>
    <div className="text-[14px] font-extrabold text-[#3182f6] px-5 pt-4">
      {step} / {total} 단계
    </div>
  </>
);

export default ProgressBar;
