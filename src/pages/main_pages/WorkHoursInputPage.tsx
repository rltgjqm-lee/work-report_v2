import { useMemo, useEffect } from "react";

import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import ProgressBar from "../../components/atoms/ProgressBar";
import Card from "../../components/atoms/Card";
import BottomBar, { BottomBarRow } from "../../components/atoms/BottomBar";
import {
  pageClass,
  bodyClass,
  labelClass,
  inputClass,
  selectClass,
  totalClass,
  btnPrimaryClass,
  btnOutlineClass,
} from "../../components/atoms/classes";

interface Page3Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSave?: () => void; // 💡 IndexedDB 임시저장 브릿지
  onNext: () => void;
  onAlert: (messages: string[]) => void;
}

/**
 * Page 3: 활동 일시
 */
const WorkHoursInputPage = ({
  formData,
  setFormData,
  onBack,
  onSave,
  onNext,
  onAlert,
}: Page3Props) => {
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

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

  // 💡 미래 날짜/시간 방지 검증 - 위반 시 에러 메시지, 통과 시 null
  const getFutureLogError = (): string | null => {
    if (formData.actDate > todayStr) {
      return "미래의 날짜로는 일지를 작성할 수 없습니다.";
    }
    if (formData.actDate === todayStr && endHour && endMin) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let end24Hour = parseInt(endHour, 10);
      if (endAmpm === "PM" && end24Hour !== 12) end24Hour += 12;
      if (endAmpm === "AM" && end24Hour === 12) end24Hour = 0;
      const endMinutes = end24Hour * 60 + parseInt(endMin, 10);

      if (endMinutes > currentMinutes) {
        return "현재 시간 이후(미래 시간)로 일지를 종료할 수 없습니다.";
      }
    }
    return null;
  };

  // 💡 임시 저장 검증 핸들러
  const handleSaveStep = () => {
    if (formData.actDate) {
      const futureError = getFutureLogError();
      if (futureError) {
        onAlert([futureError]);
        return;
      }
    }
    onSave?.();
  };

  // 💡 다음 단계 검증 핸들러
  const handleNextStep = () => {
    if (!formData.actDate) {
      onAlert(["활동일을 선택하여 주세요."]);
      return;
    }

    const futureError = getFutureLogError();
    if (futureError) {
      onAlert([futureError]);
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
    <div className={pageClass}>
      <AppBar title="활동 일시" onBack={onBack} />
      <ProgressBar step={2} />
      <div className={bodyClass}>
        <Card>
          <div>
            <label className={labelClass}>활동일</label>
            <input
              type="date"
              value={formData.actDate}
              max={todayStr}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  actDate: event.target.value,
                }))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>시작 시간</label>
            <div className="flex gap-2">
              <select
                className={selectClass}
                value={formData.startTime.ampm}
                onChange={(event) =>
                  handleTimeChange("startTime", "ampm", event.target.value)
                }
              >
                <option value="AM">오전</option>
                <option value="PM">오후</option>
              </select>
              <select
                className={selectClass}
                value={formData.startTime.hour}
                onChange={(event) =>
                  handleTimeChange("startTime", "hour", event.target.value)
                }
              >
                <option value="" disabled>
                  시
                </option>
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}시
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={formData.startTime.minute}
                onChange={(event) =>
                  handleTimeChange("startTime", "minute", event.target.value)
                }
              >
                <option value="" disabled>
                  분
                </option>
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}분
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>종료 시간</label>
            <div className="flex gap-2">
              <select
                className={selectClass}
                value={formData.endTime.ampm}
                onChange={(event) =>
                  handleTimeChange("endTime", "ampm", event.target.value)
                }
              >
                <option value="AM">오전</option>
                <option value="PM">오후</option>
              </select>
              <select
                className={selectClass}
                value={formData.endTime.hour}
                onChange={(event) =>
                  handleTimeChange("endTime", "hour", event.target.value)
                }
              >
                <option value="" disabled>
                  시
                </option>
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}시
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={formData.endTime.minute}
                onChange={(event) =>
                  handleTimeChange("endTime", "minute", event.target.value)
                }
              >
                <option value="" disabled>
                  분
                </option>
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}분
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <div
          className={`${totalClass} ${formData.actTotalTime === "시간 오류" ? "!bg-[#fdf2f2] !text-[#e74c3c]" : ""}`}
        >
          총 {formData.actTotalTime} 활동했어요
        </div>
      </div>

      <BottomBar>
        <BottomBarRow>
          <button className={btnOutlineClass} onClick={handleSaveStep}>
            저장하기
          </button>
          <button
            className={btnPrimaryClass + " flex-1"}
            onClick={handleNextStep}
          >
            다음
          </button>
        </BottomBarRow>
      </BottomBar>
    </div>
  );
};

export default WorkHoursInputPage;
