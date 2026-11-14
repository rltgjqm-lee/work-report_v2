import { Delete } from "lucide-react";

import { PIN_LENGTH } from "../../lib/appLock";

type PinPadProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

// 남색 배경 위 PIN 입력 — 점 6개 + 숫자 키패드. 6자리가 다 차면 부모가 확인한다.
const PinPad = ({ value, disabled, onChange }: PinPadProps) => (
  <div className="flex w-full flex-col items-center gap-8">
    <div className="flex gap-3.5" aria-label={`${value.length}자리 입력됨`}>
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <span
          key={index}
          className={`h-3.5 w-3.5 rounded-full ${index < value.length ? "bg-white" : "bg-white/30"}`}
        />
      ))}
    </div>
    <div className="grid w-full max-w-xs grid-cols-3 gap-2">
      {KEYS.map((key, index) => {
        if (key === "") return <span key={index} />;
        if (key === "back") {
          return (
            <button
              key={index}
              type="button"
              aria-label="한 자리 지우기"
              disabled={disabled || value.length === 0}
              onClick={() => onChange(value.slice(0, -1))}
              className="flex h-16 items-center justify-center rounded-2xl text-white active:bg-white/10 disabled:opacity-40"
            >
              <Delete size={26} aria-hidden="true" />
            </button>
          );
        }
        return (
          <button
            key={index}
            type="button"
            disabled={disabled || value.length >= PIN_LENGTH}
            onClick={() => onChange(value + key)}
            className="h-16 rounded-2xl text-[26px] font-extrabold text-white active:bg-white/10 disabled:opacity-60"
          >
            {key}
          </button>
        );
      })}
    </div>
  </div>
);

export default PinPad;
