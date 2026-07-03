interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "blue" | "white";
  children: React.ReactNode;
}

const Button = ({
  variant = "blue",
  children,
  className = "",
  ...props
}: ButtonProps) => {
  // 1. 파란색 배경, 흰색 글씨 (기본값)
  const blueStyle = "bg-[#00a0e9] text-white border-none";

  // 2. 흰색 배경, 검정색 글씨
  const whiteStyle = "bg-white text-[#222] border border-[#222]";

  return (
    <button
      className={`flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer max-[600px]:p-[12px] max-[600px]:text-[15px] ${
        variant === "blue" ? blueStyle : whiteStyle
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
