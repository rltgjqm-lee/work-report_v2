import TextInput from "../atoms/TextInput";
import type { TextInputProps } from "../atoms/TextInput";

interface LabeledInput extends TextInputProps {
  labelTitle: string | React.ReactNode;
}

const LabeledInput = ({
  labelTitle,
  id,
  placeholder,
  value,
  onChange,
  className = "",
}: LabeledInput) => {
  return (
    <>
      <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        {labelTitle}
      </div>

      <TextInput {...{ id, placeholder, value, onChange, className }} />
    </>
  );
};
export default LabeledInput;
