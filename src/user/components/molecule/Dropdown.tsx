import type { ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { labelClass, selectClass } from "../../../components/atoms/classes";

type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * 참여자용 페이지에서 공통으로 쓰는 select 드롭다운입니다. label을 넘기지 않으면
 * (예: 시작/종료 시간처럼 여러 개가 한 라벨 아래 나란히 있는 경우) 라벨 없이 select만 렌더링합니다.
 */
const Dropdown = ({ value, onChange, options, label, disabled, className }: DropdownProps) => (
  <div className={`flex-1 min-w-0 ${className ?? ""}`}>
    {label && <label className={labelClass}>{label}</label>}
    <div className="relative">
      <select
        className={selectClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  </div>
);

export default Dropdown;
