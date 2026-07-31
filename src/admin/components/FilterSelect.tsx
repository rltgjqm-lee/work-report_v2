import { ChevronDown } from "lucide-react";

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
  disabled?: boolean;
}

/**
 * 여러 페이지의 필터/폼에서 공통으로 쓰는 select 드롭다운입니다.
 *
 */
// className은 폭 지정용(예: "w-full")으로 바깥 wrapper에 적용하고, select 자체는
// 항상 w-full로 wrapper를 꽉 채운다 — 화살표 아이콘을 얹으려면 wrapper가 필요하다.
const FilterSelect = ({
  value,
  onChange,
  options,
  className,
  disabled,
}: FilterSelectProps) => (
  <div className={`relative ${className ?? "inline-block"}`}>
    <select
      className={`${selectClass} w-full`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>

    <ChevronDown
      size={14}
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b7280]"
    />
  </div>
);

export default FilterSelect;
