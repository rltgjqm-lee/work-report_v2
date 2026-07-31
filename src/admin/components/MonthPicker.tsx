interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * "YYYY-MM" 월 선택 인풋 영역입니다.
 *
 */
const MonthPicker = ({ value, onChange }: MonthPickerProps) => (
  <input
    type="month"
    className="flex-none border border-[#d7dbe1] px-3 py-2.5 text-[13px] rounded-[2px] font-sans box-border"
    value={value}
    onChange={(event) => onChange(event.target.value)}
  />
);

export default MonthPicker;
