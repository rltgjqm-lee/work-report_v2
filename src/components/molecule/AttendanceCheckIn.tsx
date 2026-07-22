import { useEffect, useState } from "react";

import { labelClass, labelSmallClass } from "../atoms/classes";
import Button from "../atoms/Button";
import LabeledInput from "./LabeledInput";
import {
  clockIn,
  clockOut,
  identifyParticipant,
} from "../../utils/attendanceApi";
import { LOCAL_STORAGE_KEYS } from "../../constants/storage";

type CachedParticipant = { participantId: number; name: string };

const readCachedParticipant = (): CachedParticipant | null => {
  const raw = localStorage.getItem(
    LOCAL_STORAGE_KEYS.ATTENDANCE_PARTICIPANT_ID,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * 사업단 선택 후 노출되는 셀프 출퇴근 체크. GPS 검증 없이, 최초 1회
 * 이름+전화번호 뒤4자리로 본인을 확인하면 이후에는 기기에 저장해두고 재사용한다.
 */
const AttendanceCheckIn = ({
  programId,
  onIdentified,
}: {
  programId: number | null;
  onIdentified?: (participant: CachedParticipant) => void;
}) => {
  const [participant, setParticipant] = useState<CachedParticipant | null>(
    readCachedParticipant,
  );
  const [name, setName] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  // 이미 캐시된 식별 결과가 있으면 마운트 시점에 상위로도 알려준다 (activityLogs 연결용)
  useEffect(() => {
    if (participant) onIdentified?.(participant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!programId) return null;

  const handleIdentifyButtonClick = async () => {
    if (!name || !/^\d{4}$/.test(phoneLast4)) {
      setStatus("이름과 전화번호 뒷 4자리(숫자)를 입력해주세요.");
      return;
    }
    try {
      const result = await identifyParticipant(programId, name, phoneLast4);
      const cached: CachedParticipant = {
        participantId: result.participantId,
        name: result.name,
      };
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.ATTENDANCE_PARTICIPANT_ID,
        JSON.stringify(cached),
      );
      setParticipant(cached);
      setStatus(null);
      onIdentified?.(cached);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "본인 확인에 실패했습니다.",
      );
    }
  };

  const handleClockInButtonClick = async () => {
    if (!participant) return;
    try {
      await clockIn(participant.participantId);
      setStatus("출근 처리되었습니다.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "출근 처리에 실패했습니다.",
      );
    }
  };

  const handleClockOutButtonClick = async () => {
    if (!participant) return;
    try {
      const result = await clockOut(participant.participantId);
      setStatus(`퇴근 처리되었습니다. (근무 ${result.totalMinutes}분)`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "퇴근 처리에 실패했습니다.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className={labelClass}>근태 체크</div>

      {participant ? (
        <div className="flex flex-col gap-3.5">
          <div className="text-[15px] font-semibold text-[#1f2937]">
            <span className="font-extrabold text-[#3182f6]">
              {participant.name}
            </span>
            님, 출퇴근을 체크해주세요.
          </div>
          <div className="flex gap-2.5">
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleClockInButtonClick}
            >
              출근
            </Button>
            <Button variant="outline" onClick={handleClockOutButtonClick}>
              퇴근
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div>
            <LabeledInput
              labelTitle="이름"
              id="attendance-name"
              placeholder="성함 입력"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <LabeledInput
              labelTitle="전화번호 뒷자리(4자리)"
              id="attendance-phone"
              placeholder="0000"
              value={phoneLast4}
              onChange={(event) =>
                setPhoneLast4(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </div>
          <Button variant="primary" onClick={handleIdentifyButtonClick}>
            본인 확인
          </Button>
        </div>
      )}

      {status && <div className={labelSmallClass}>{status}</div>}
    </div>
  );
};

export default AttendanceCheckIn;
