import { labelClass } from "../atoms/classes";
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
      <label className={labelClass} htmlFor={id}>
        {labelTitle}
      </label>

      <TextInput {...{ id, placeholder, value, onChange, className }} />
    </>
  );
};
export default LabeledInput;
