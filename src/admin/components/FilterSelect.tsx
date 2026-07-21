import { selectClass } from "../uiClasses";

type FilterSelectOption = {
  value: string;
  label: string;
};

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  className?: string;
}

// 목록 툴바의 필터 드롭다운 전용 — "전체"/"선택하세요" 같은 옵션도
// 호출하는 쪽에서 options 배열에 그대로 포함시켜서 넘긴다.
const FilterSelect = ({
  value,
  onChange,
  options,
  className,
}: FilterSelectProps) => (
  <select
    className={className ? `${selectClass} ${className}` : selectClass}
    value={value}
    onChange={(event) => onChange(event.target.value)}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default FilterSelect;
