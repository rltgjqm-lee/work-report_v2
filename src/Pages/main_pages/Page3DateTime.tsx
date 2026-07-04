import { useMemo, useEffect } from "react";

import type { ActivityLogFormData } from "../../types/form";
import Button from "../../components/atoms/Button";

interface Page3Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onSave?: () => void; // 💡 IndexedDB 임시저장 브릿지
  onNext: () => void;
  onAlert: (messages: string[]) => void;
}

/**
 * Page 3: 활동 일시
 */
const Page3DateTime = ({
  formData,
  setFormData,
  onSave,
  onNext,
  onAlert,
}: Page3Props) => {
  // 💡 [시간 옵션 배열 생성] 기존 바닐라 JS의 for() 루프 구조를 useMemo 메모이제이션으로 선언적 치환
  const hourOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    [],
  );
  const minuteOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")),
    [],
  );

  // 💡 [실시간 총 시간 연산 로직] 기존 updateTime() 및 계산 파트를 리액트 이펙트로 완벽 이식
  // 💡 1. useEffect 바로 윗줄에서 필요한 시간 속성들을 미리 변수로 발라냅니다.
  const startAmpm = formData.startTime.ampm;
  const startHour = formData.startTime.hour;
  const startMin = formData.startTime.minute;
  const endAmpm = formData.endTime.ampm;
  const endHour = formData.endTime.hour;
  const endMin = formData.endTime.minute;

  // 💡 2. useEffect 본문에서는 오직 위에서 발라낸 변수들만 씁니다.
  useEffect(() => {
    if (!startHour || !startMin || !endHour || !endMin) {
      setFormData((prev) => {
        if (prev.actTotalTime === "- 시간") return prev;
        return { ...prev, actTotalTime: "- 시간" };
      });
      return;
    }

    let start24Hour = parseInt(startHour, 10);
    if (startAmpm === "PM" && start24Hour !== 12) start24Hour += 12;
    if (startAmpm === "AM" && start24Hour === 12) start24Hour = 0;

    let end24Hour = parseInt(endHour, 10);
    if (endAmpm === "PM" && end24Hour !== 12) end24Hour += 12;
    if (endAmpm === "AM" && end24Hour === 12) end24Hour = 0;

    const startMinutes = start24Hour * 60 + parseInt(startMin, 10);
    const endMinutes = end24Hour * 60 + parseInt(endMin, 10);

    if (endMinutes < startMinutes) {
      setFormData((prev) => {
        if (prev.actTotalTime === "시간 오류") return prev;
        return { ...prev, actTotalTime: "시간 오류" };
      });
      return;
    }

    const diffMinutes = endMinutes - startMinutes;
    const diffHour = Math.floor(diffMinutes / 60);
    const diffMin = diffMinutes % 60;

    let totalTimeStr = `${diffHour}시간`;
    if (diffMin > 0) totalTimeStr += ` ${diffMin}분`;

    setFormData((prev) => {
      if (prev.actTotalTime === totalTimeStr) return prev;
      return { ...prev, actTotalTime: totalTimeStr };
    });
  }, [startAmpm, startHour, startMin, endAmpm, endHour, endMin, setFormData]);

  // 💡 중복 타겟 바인딩을 제거하는 단일 시간 객체 조절 유틸 핸들러
  const handleTimeChange = (
    type: "startTime" | "endTime",
    field: "ampm" | "hour" | "minute",
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }));
  };

  // 💡 다음 단계 검증 핸들러
  const handleNextStep = () => {
    if (!formData.actDate) {
      onAlert(["활동일을 선택하여 주세요."]);
      return;
    }
    if (
      formData.actTotalTime === "- 시간" ||
      formData.actTotalTime === "시간 오류"
    ) {
      onAlert(["올바른 활동 시간을 지정하여 주세요."]);
      return;
    }
    onNext();
  };

  return (
    <div
      className="p-[30px_20px] flex flex-1 flex-col max-[600px]:p-[20px_15px]"
      id="page3"
    >
      <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
        활동 일시를 입력해주세요
      </div>

      {/* 활동일 입력칸 */}
      <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          활동일{" "}
          <span className="text-[12px] font-normal text-[#e74c3c]">
            (*활동일을 선택해 주세요)
          </span>
        </div>
        <input
          type="date"
          id="actDate"
          value={formData.actDate}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, actDate: e.target.value }))
          }
          className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
        />
      </div>

      {/* 활동시간 복합 선택 셀렉트 그리드 */}
      <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          활동시간을 선택하여 주세요 <br />
          <span className="text-[12px] font-normal text-[#e74c3c]">
            (*활동 종료 후 시간을 선택해 주세요)
          </span>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {/* 시작 시간 설정 */}
          <div className="w-full">
            <div className="mb-1 font-bold text-[#34495e] text-[14px]">
              시작
            </div>
            <div className="flex gap-2 w-full">
              <select
                value={formData.startTime.ampm}
                onChange={(e) =>
                  handleTimeChange("startTime", "ampm", e.target.value)
                }
                className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              >
                <option value="AM">오전</option>
                <option value="PM">오후</option>
              </select>
              <select
                value={formData.startTime.hour}
                onChange={(e) =>
                  handleTimeChange("startTime", "hour", e.target.value)
                }
                className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              >
                <option value="" disabled>
                  시
                </option>
                {hourOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}시
                  </option>
                ))}
              </select>
              <span className="text-[16px] font-bold self-center">:</span>
              <select
                value={formData.startTime.minute}
                onChange={(e) =>
                  handleTimeChange("startTime", "minute", e.target.value)
                }
                className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              >
                <option value="" disabled>
                  분
                </option>
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}분
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 종료 시간 설정 */}
          <div className="w-full">
            <div className="mb-1 font-bold text-[#34495e] text-[14px]">
              종료
            </div>
            <div className="flex gap-2 w-full">
              <select
                value={formData.endTime.ampm}
                onChange={(e) =>
                  handleTimeChange("endTime", "ampm", e.target.value)
                }
                className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              >
                <option value="AM">오전</option>
                <option value="PM">오후</option>
              </select>
              <select
                value={formData.endTime.hour}
                onChange={(e) =>
                  handleTimeChange("endTime", "hour", e.target.value)
                }
                className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              >
                <option value="" disabled>
                  시
                </option>
                {hourOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}시
                  </option>
                ))}
              </select>
              <span className="text-[16px] font-bold self-center">:</span>
              <select
                value={formData.endTime.minute}
                onChange={(e) =>
                  handleTimeChange("endTime", "minute", e.target.value)
                }
                className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              >
                <option value="" disabled>
                  분
                </option>
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}분
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 총 활동 시간 */}
      <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <div className="font-bold text-[#34495e] mb-1">총</div>
        <div className="flex items-center gap-2.5 w-full">
          <div
            id="actTotalTime"
            className={`w-full p-[14px] text-[16px] border-[2.5px] rounded-xl outline-none text-center font-bold max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px] ${
              formData.actTotalTime === "시간 오류"
                ? "border-[#e74c3c] text-[#e74c3c] bg-[#fdf2f2]"
                : "border-[#2c3e50] text-[#00a0e9] bg-[#f9f9f9]"
            }`}
          >
            {formData.actTotalTime}
          </div>
        </div>
      </div>

      {/* 하단 액션 버튼 */}
      <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
        <Button variant="blue" onClick={onSave}>
          저장하기
        </Button>
        <Button variant="white" onClick={handleNextStep}>
          다음
        </Button>
      </div>
    </div>
  );
};

export default Page3DateTime;
