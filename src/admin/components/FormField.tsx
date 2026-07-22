import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  children: ReactNode;
}

/**
 * 폼 입력 필드에 라벨을 붙이는 공통 wrapper입니다.
 *
 */
const FormField = ({ label, children }: FormFieldProps) => (
  <div>
    <label className="block text-[12.5px] font-semibold text-[#374151] mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

export default FormField;
