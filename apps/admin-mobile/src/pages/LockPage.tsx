import { useCallback, useEffect, useRef, useState } from "react";

import { Fingerprint } from "lucide-react";

import { useSession } from "../context/useSession";

import PinPad from "../components/organism/PinPad";
import { authenticateWithBiometry, isBiometryAvailable, PIN_LENGTH } from "../lib/appLock";

const LockPage = () => {
  const {
    profile,
    isLockEnabled,
    unlockError,
    unlockWithPin,
    unlockWithBiometry,
    retryUnlock,
    logout,
  } = useSession();
  const [canUseBiometry, setCanUseBiometry] = useState(false);
  const [isPinMode, setIsPinMode] = useState(false);
  const [pin, setPin] = useState("");
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const hasPromptedRef = useRef(false);

  const handleBiometryButtonClick = useCallback(async () => {
    const result = await authenticateWithBiometry();
    if (result === "ok") await unlockWithBiometry();
    else setIsPinMode(true);
  }, [unlockWithBiometry]);

  // 잠금 화면이 뜨자마자 지문 창을 띄운다(지문이 없는 폰이면 바로 PIN)
  useEffect(() => {
    if (!isLockEnabled || hasPromptedRef.current) return;
    hasPromptedRef.current = true;
    isBiometryAvailable().then((available) => {
      setCanUseBiometry(available);
      if (available) handleBiometryButtonClick();
      else setIsPinMode(true);
    });
  }, [isLockEnabled, handleBiometryButtonClick]);

  const handlePinChange = async (nextPin: string) => {
    setPin(nextPin);
    if (nextPin.length < PIN_LENGTH) return;
    setIsChecking(true);
    const result = await unlockWithPin(nextPin);
    setIsChecking(false);
    if (!result.ok) {
      setPin("");
      setPinMessage(result.message ?? null);
    }
  };

  return (
    <div className="flex min-h-full flex-col items-center bg-accent px-8 pt-20 pb-10">
      <img src="./app-icon.png" alt="" className="h-[72px] w-[72px] rounded-[22px]" />
      <h1 className="mt-5 text-[26px] font-extrabold text-white">{profile?.name ?? "담당자"}님</h1>
      {profile?.organizationName && (
        <p className="mt-2 text-[15px] font-semibold text-white/80">{profile.organizationName}</p>
      )}

      <div className="flex w-full flex-1 flex-col items-center justify-center gap-5 py-10">
        {unlockError ? (
          <>
            <p className="text-center text-base font-bold text-white">{unlockError}</p>
            <button
              type="button"
              onClick={retryUnlock}
              className="h-14 rounded-[18px] bg-white px-8 text-base font-extrabold text-accent"
            >
              다시 시도
            </button>
          </>
        ) : isPinMode || !canUseBiometry ? (
          <>
            <p className="text-lg font-extrabold text-white">PIN을 입력해주세요</p>
            <PinPad value={pin} disabled={isChecking} onChange={handlePinChange} />
            <p className="min-h-5 text-center text-sm font-bold text-on-accent-error">
              {pinMessage}
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={handleBiometryButtonClick}
            className="flex flex-col items-center gap-5"
          >
            <span className="flex h-28 w-28 items-center justify-center rounded-full bg-white/15 shadow-[0_0_0_14px_rgba(255,255,255,.06)]">
              <Fingerprint size={58} strokeWidth={1.6} color="#fff" aria-hidden="true" />
            </span>
            <span className="text-lg font-extrabold text-white">지문으로 잠금 해제</span>
          </button>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-1.5">
        {canUseBiometry && isPinMode && !unlockError && (
          <button
            type="button"
            onClick={handleBiometryButtonClick}
            className="px-4 py-3 text-base font-extrabold text-white"
          >
            지문으로 풀기
          </button>
        )}
        {canUseBiometry && !isPinMode && !unlockError && (
          <button
            type="button"
            onClick={() => setIsPinMode(true)}
            className="px-4 py-3 text-base font-extrabold text-white"
          >
            PIN으로 입력
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          className="px-4 py-2.5 text-sm font-bold text-white/80"
        >
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  );
};

export default LockPage;
