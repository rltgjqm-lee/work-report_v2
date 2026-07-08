import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  children: ReactNode;
}

const FormField = ({ label, children }: FormFieldProps) => (
  <div>
    <label className="block text-[12.5px] font-semibold text-[#374151] mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

export default FormField;
