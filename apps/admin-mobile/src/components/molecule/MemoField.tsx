type MemoFieldProps = {
  id: string;
  value: string;
  presets: string[];
  onChange: (value: string) => void;
};

// 처리 메모 — 자주 쓰는 문구를 눌러 붙이고, 이어서 직접 적는다
const MemoField = ({ id, value, presets, onChange }: MemoFieldProps) => (
  <div className="flex flex-col gap-2.5">
    <label htmlFor={id} className="text-base font-extrabold text-ink">
      처리 메모
    </label>
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(value ? `${value}, ${preset}` : preset)}
          className="rounded-full border-[1.5px] border-line bg-white px-3.5 py-2 text-sm font-bold text-ink-sub"
        >
          + {preset}
        </button>
      ))}
    </div>
    <textarea
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="어떻게 확인하고 조치했는지 적어주세요"
      rows={3}
      className="w-full resize-none rounded-2xl border-2 border-input-line bg-white px-4 py-3.5 text-[15px] font-semibold text-ink outline-none focus:border-accent"
    />
  </div>
);

export default MemoField;
