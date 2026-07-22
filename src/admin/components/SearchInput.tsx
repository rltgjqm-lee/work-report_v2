import { searchInputClass } from "../uiClasses";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * 여러 페이지의 목록 검색창에서 공통으로 쓰는 입력창입니다.
 *
 */
const SearchInput = ({
  value,
  onChange,
  placeholder,
  className,
}: SearchInputProps) => (
  <input
    className={
      className ? `${searchInputClass} ${className}` : searchInputClass
    }
    placeholder={placeholder}
    value={value}
    onChange={(event) => onChange(event.target.value)}
  />
);

export default SearchInput;
