import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSession } from "../context/useSession";

import PinPad from "../components/organism/PinPad";
import { PIN_LENGTH } from "../lib/appLock";

type PinSetupPageProps = {
  // 첫 로그인 직후(잠금 해제 전)인지, 내 정보에서 PIN을 바꾸거나 잠금을 켜는 건지
  mode: "initial" | "change";
};

// 같은 PIN을 두 번 넣어 확인한 뒤 저장한다
const PinSetupPage = ({ mode }: PinSetupPageProps) => {
  const navigate = useNavigate();
  const { completePinSetup, profile } = useSession();
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handlePinChange = async (nextPin: string) => {
    setPin(nextPin);
    if (nextPin.length < PIN_LENGTH) return;
    if (firstPin === null) {
      setFirstPin(nextPin);
      setPin("");
      setErrorMessage(null);
      return;
    }
    if (nextPin !== firstPin) {
      setFirstPin(null);
      setPin("");
      setErrorMessage("두 번 입력한 PIN이 달라요. 처음부터 다시 입력해주세요.");
      return;
    }
    setIsSaving(true);
    await completePinSetup(nextPin);
    if (mode === "change") navigate("/me", { replace: true });
  };

  return (
    <div className="flex min-h-full flex-col items-center bg-accent px-8 pt-20 pb-10">
      {mode === "initial" && (
        <p className="text-[15px] font-semibold text-white/80">
          {profile?.name ?? "담당자"}님, 환영해요
        </p>
      )}
      <h1 className="mt-2 text-center text-[24px] leading-snug font-extrabold text-white">
        {firstPin === null ? "앱 잠금 PIN 6자리를 정해주세요" : "한 번 더 입력해주세요"}
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed font-semibold text-white/80">
        앱을 다시 열 때 지문이나 이 PIN으로 잠금을 풀어요.
        <br />
        5번 틀리면 로그아웃돼요.
      </p>
      <div className="flex flex-1 flex-col justify-center py-10">
        <PinPad value={pin} disabled={isSaving} onChange={handlePinChange} />
      </div>
      <p className="min-h-6 text-center text-sm font-bold text-on-accent-error">{errorMessage}</p>
      {mode === "change" && (
        <button
          type="button"
          onClick={() => navigate("/me", { replace: true })}
          className="mt-2 px-4 py-2.5 text-sm font-bold text-white/80"
        >
          취소
        </button>
      )}
    </div>
  );
};

export default PinSetupPage;
