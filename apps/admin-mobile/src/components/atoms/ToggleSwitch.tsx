type ToggleSwitchProps = {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

const ToggleSwitch = ({ checked, label, disabled, onChange }: ToggleSwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`flex h-[30px] w-[52px] flex-none items-center rounded-full p-[3px] transition-colors disabled:opacity-50 ${
      checked ? "justify-end bg-accent" : "justify-start bg-switch-off"
    }`}
  >
    <span className="h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)]" />
  </button>
);

export default ToggleSwitch;
