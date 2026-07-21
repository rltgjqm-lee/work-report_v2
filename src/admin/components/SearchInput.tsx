import { searchInputClass } from "../uiClasses";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

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
