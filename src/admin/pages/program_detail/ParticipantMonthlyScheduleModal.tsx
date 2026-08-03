import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteParticipantMonthlyScheduleMutationOptions,
  groupMonthlyScheduleQueryOptions,
  participantMonthlyScheduleQueryOptions,
  updateParticipantMonthlyScheduleMutationOptions,
} from "../../api/admin/monthlySchedule";
import { generateWorkPattern } from "../../utils/generateWorkPattern";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import MonthlyScheduleCalendar from "../../components/MonthlyScheduleCalendar";
import { btnGhostClass, btnPrimaryClass, compactInputClass, inputClass } from "../../uiClasses";
import { getLocalYearMonth } from "../../../utils/timeFormat";
import type { Group, Participant } from "../../types";

const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

interface ParticipantMonthlyScheduleModalProps {
  onClose: () => void;
  participant: Participant;
  group?: Group;
}

/**
 * 관리자 페이지 > 사업단 상세 페이지에서 참여자 개인의 월간 근무 스케줄 예외를
 * 설정하는 모달입니다. 예외가 없으면 조 기본 스케줄을 그대로 따릅니다.
 */
const ParticipantMonthlyScheduleModal = ({
  onClose,
  participant,
  group,
}: ParticipantMonthlyScheduleModalProps) => {
  const [yearMonth, setYearMonth] = useState(getLocalYearMonth);
  const [hasOverride, setHasOverride] = useState(false);
  const [workDates, setWorkDates] = useState<string[]>([]);
  const [maxMonthlyHours, setMaxMonthlyHours] = useState("");
  const [patternWorkDays, setPatternWorkDays] = useState("1");
  const [patternRestDays, setPatternRestDays] = useState("2");
  const queryClient = useQueryClient();

  const { data: participantSchedule, isFetching: isParticipantScheduleFetching } = useQuery(
    participantMonthlyScheduleQueryOptions(participant.id, yearMonth),
  );
  const { data: groupSchedule, isFetching: isGroupScheduleFetching } = useQuery({
    ...groupMonthlyScheduleQueryOptions(participant.groupId ?? 0, yearMonth),
    enabled: !!participant.groupId,
  });

  const loading =
    isParticipantScheduleFetching || (!!participant.groupId && isGroupScheduleFetching);

  const groupDefaultDates = groupSchedule?.workDates ?? [];
  const groupMaxMonthlyMinutes = groupSchedule?.maxMonthlyMinutes ?? 1800;

  const updateParticipantMonthlyScheduleMutation = useMutation(
    updateParticipantMonthlyScheduleMutationOptions(queryClient),
  );
  const deleteParticipantMonthlyScheduleMutation = useMutation(
    deleteParticipantMonthlyScheduleMutationOptions(queryClient),
  );

  useEffect(() => {
    if (!participantSchedule) return;

    if (participantSchedule.workDates !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 조회된 초기값을 편집 가능한 로컬 상태로 동기화
      setHasOverride(true);
      setWorkDates(participantSchedule.workDates);
      setMaxMonthlyHours(
        participantSchedule.maxMonthlyMinutes !== null
          ? String(participantSchedule.maxMonthlyMinutes / 60)
          : "",
      );
    } else {
      setHasOverride(false);
      setWorkDates([]);
      setMaxMonthlyHours("");
    }
  }, [participantSchedule]);

  // group이 있으면 조 근무시간(shiftStart~shiftEnd) 기준 하루 근무분으로 월 상한 초과를 미리 막는다.
  // 개인 상한을 비워두면 조 기본 상한(groupMaxMonthlyMinutes)을 그대로 따른다.
  const shiftMinutesPerDay = group
    ? Math.max(0, toMinutes(group.shiftEnd) - toMinutes(group.shiftStart))
    : 0;
  const effectiveMaxMinutes = maxMonthlyHours
    ? Math.round(Number(maxMonthlyHours) * 60) || 0
    : groupMaxMonthlyMinutes;
  const projectedMinutes = workDates.length * shiftMinutesPerDay;
  const isOverCap =
    shiftMinutesPerDay > 0 && effectiveMaxMinutes > 0 && projectedMinutes > effectiveMaxMinutes;

  const handleStartOverrideButtonClick = () => {
    setHasOverride(true);
    setWorkDates(groupDefaultDates);
  };

  const handleRevertToGroupButtonClick = () => {
    if (!confirm("개인 예외를 삭제하고 조 스케줄을 따르게 할까요?")) return;
    deleteParticipantMonthlyScheduleMutation.mutate(
      { participantId: participant.id, yearMonth },
      {
        onSuccess: () => onClose(),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleToggleDate = (date: string) => {
    const isAdding = !workDates.includes(date);
    if (isAdding && shiftMinutesPerDay > 0 && effectiveMaxMinutes > 0) {
      const nextMinutes = (workDates.length + 1) * shiftMinutesPerDay;
      if (nextMinutes > effectiveMaxMinutes) {
        const maxDays = Math.floor(effectiveMaxMinutes / shiftMinutesPerDay);
        alert(
          `월 근무시간 상한(${(effectiveMaxMinutes / 60).toFixed(1)}시간)을 초과합니다. 하루 ${(
            shiftMinutesPerDay / 60
          ).toFixed(1)}시간 기준으로 최대 ${maxDays}일까지 선택할 수 있어요.`,
        );
        return;
      }
    }

    setWorkDates((current) =>
      current.includes(date)
        ? current.filter((workDate) => workDate !== date)
        : [...current, date].sort(),
    );
  };

  const handleGeneratePatternButtonClick = () => {
    const workDays = Number(patternWorkDays);
    const restDays = Number(patternRestDays);
    if (!workDays || workDays < 1 || restDays < 0) {
      alert("근무일/휴무일을 올바르게 입력해주세요.");

      return;
    }
    setWorkDates(generateWorkPattern(yearMonth, workDays, restDays));
  };

  const handleSaveButtonClick = () => {
    if (workDates.length === 0) {
      alert("자동 생성 버튼을 눌러 근무일을 먼저 만들어주세요.");
      return;
    }
    if (isOverCap) {
      alert("선택된 근무일이 월 근무시간 상한을 초과합니다. 근무일을 줄이거나 상한을 늘려주세요.");
      return;
    }
    updateParticipantMonthlyScheduleMutation.mutate(
      {
        participantId: participant.id,
        yearMonth,
        workDates,
        maxMonthlyMinutes: maxMonthlyHours ? Math.round(Number(maxMonthlyHours) * 60) : null,
      },
      {
        onSuccess: () => onClose(),
        onError: (error) => alert(error instanceof Error ? error.message : "저장에 실패했습니다."),
      },
    );
  };

  return (
    <SlideModal
      isOpen
      title={`${participant.name} — 개인 근무 스케줄 예외`}
      onClose={onClose}
      footer={
        hasOverride ? (
          <>
            <button className={btnGhostClass} onClick={handleRevertToGroupButtonClick}>
              조 스케줄로 되돌리기
            </button>
            <button className={btnPrimaryClass} onClick={handleSaveButtonClick}>
              저장
            </button>
          </>
        ) : (
          <button className={btnGhostClass} onClick={onClose}>
            닫기
          </button>
        )
      }
    >
      <FormField label="월">
        <input
          type="month"
          className={inputClass}
          value={yearMonth}
          onChange={(event) => setYearMonth(event.target.value)}
        />
      </FormField>

      {loading ? (
        <div className="text-[13px] text-[#9aa1ab] py-4 text-center">불러오는 중...</div>
      ) : hasOverride ? (
        <>
          <FormField label="월 근무시간 상한(시간, 비우면 조 기본값 따름)">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={maxMonthlyHours}
              onChange={(event) => setMaxMonthlyHours(event.target.value)}
            />
          </FormField>
          <FormField label="패턴 자동생성 (예: 1근무 2휴무)">
            <div className="flex items-center gap-2 flex-nowrap">
              <input
                type="number"
                min={1}
                className={compactInputClass}
                value={patternWorkDays}
                onChange={(event) => setPatternWorkDays(event.target.value)}
              />
              <span className="text-[13px] text-[#6b7280] whitespace-nowrap">일 근무 /</span>
              <input
                type="number"
                min={0}
                className={compactInputClass}
                value={patternRestDays}
                onChange={(event) => setPatternRestDays(event.target.value)}
              />
              <span className="text-[13px] text-[#6b7280] whitespace-nowrap">일 휴무</span>
              <button className={btnGhostClass} onClick={handleGeneratePatternButtonClick}>
                자동 생성
              </button>
            </div>
          </FormField>
          <FormField label="근무일 (클릭해서 선택/해제)">
            <MonthlyScheduleCalendar
              yearMonth={yearMonth}
              selectedDates={workDates}
              onToggleDate={handleToggleDate}
            />
          </FormField>
          <div
            className={`text-[12px] ${isOverCap ? "text-[#e94b4b] font-semibold" : "text-[#9aa1ab]"}`}
          >
            선택된 근무일: {workDates.length}일
            {shiftMinutesPerDay > 0 && (
              <>
                {" "}
                · 예상 근무시간: {(projectedMinutes / 60).toFixed(1)}시간 / 상한{" "}
                {(effectiveMaxMinutes / 60).toFixed(1)}시간
                {isOverCap && " (상한 초과)"}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="text-[13px] text-[#6b7280]">
            개인 예외가 없어 조 기본 스케줄({groupDefaultDates.length}일)을 그대로 따르고 있습니다.
          </div>
          <FormField label="조 기본 근무일 (참고용, 편집 불가)">
            <MonthlyScheduleCalendar
              yearMonth={yearMonth}
              selectedDates={groupDefaultDates}
              onToggleDate={() => {}}
            />
          </FormField>
          <button className={btnGhostClass} onClick={handleStartOverrideButtonClick}>
            이 참여자만 다른 스케줄 설정하기
          </button>
        </>
      )}
    </SlideModal>
  );
};

export default ParticipantMonthlyScheduleModal;
