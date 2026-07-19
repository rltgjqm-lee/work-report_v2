import { btnPrimaryClass, btnOutlineClass, btnTextClass } from "./classes";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "text";
  children: React.ReactNode;
}

const VARIANT_CLASS = {
  primary: btnPrimaryClass,
  outline: btnOutlineClass,
  text: btnTextClass,
};

const Button = ({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) => {
  return (
    <button className={`${VARIANT_CLASS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
