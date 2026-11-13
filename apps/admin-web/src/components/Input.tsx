import { compactInputClass, flexInputClass, inputClass } from "../uiClasses";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // 폭 고정(64px) — 숫자 한두 자리처럼 내용이 짧고 길이가 안 변하는 인풋.
  compact?: boolean;
  // 한 줄에서 남는 폭을 나눠 가짐 — 날짜/시간처럼 compact로는 잘리는 인풋.
  // 폭을 호출부에서 className으로 덮어쓰는 건 안 먹으므로(uiClasses.ts 주석 참고)
  // 폭을 정하는 건 항상 이 둘 중 하나를 고르는 식이다.
  flex?: boolean;
}

const Input = ({ compact = false, flex = false, className = "", ...props }: InputProps) => {
  const baseClass = flex ? flexInputClass : compact ? compactInputClass : inputClass;

  return <input className={`${baseClass} ${className}`} {...props} />;
};

export default Input;
