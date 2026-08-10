import { compactInputClass, inputClass } from "../uiClasses";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  compact?: boolean;
}

const Input = ({ compact = false, className = "", ...props }: InputProps) => (
  <input className={`${compact ? compactInputClass : inputClass} ${className}`} {...props} />
);

export default Input;
