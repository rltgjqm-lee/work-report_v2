import { btnGhostClass, btnPrimaryClass } from "../uiClasses";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  children: React.ReactNode;
}

const VARIANT_CLASS = {
  primary: btnPrimaryClass,
  ghost: btnGhostClass,
};

const Button = ({ variant = "primary", children, className = "", ...props }: ButtonProps) => (
  <button className={`${VARIANT_CLASS[variant]} ${className}`} {...props}>
    {children}
  </button>
);

export default Button;
