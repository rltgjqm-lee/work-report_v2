import { inputClass } from "./classes";

export interface TextInputProps {
  id: string;
  placeholder: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  className?: string;
}

const TextInput = ({
  id,
  placeholder,
  value,
  onChange,
  className = "",
  ...props
}: TextInputProps) => {
  return (
    <input
      type="text"
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`${inputClass} ${className}`}
      {...props}
    />
  );
};

export default TextInput;
