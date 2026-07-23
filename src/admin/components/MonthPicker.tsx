interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * "YYYY-MM" 월 선택 인풋. flex-none이라 어떤 flex 컨테이너(justify-between 등)에
 * 넣어도 너비가 늘어나 옆 라벨을 밀어내지 않는다 — inputClass(w-full)를 직접
 * 쓰면 이 문제가 생겨서 별도 컴포넌트로 뺐다.
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
