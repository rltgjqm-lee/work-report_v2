export interface TextInputProps {
  id: string;
  placeholder: string;
  value?: string;
  onChange?: () => void;
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
      className={`w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px] ${className}`}
      {...props}
    />
  );
};

export default TextInput;
