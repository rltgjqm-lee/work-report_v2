import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getLocalToday } from "../../../utils/timeFormat";
import {
  cancelTrainingLogMutationOptions,
  createTrainingLogMutationOptions,
  createTrainingMutationOptions,
  trainingComplianceQueryOptions,
  trainingLogsQueryOptions,
  trainingsQueryOptions,
  updateTrainingMutationOptions,
  type ProjectTraining,
  type TrainingCategory,
  type TrainingLogRow,
  type TrainingPayMode,
} from "../../api/admin/trainings";
import { useToast } from "../../context/useToast";
import type { Participant } from "../../types/participants";

import SubTabBar from "../../components/bar/SubTabBar";
import Button from "../../components/Button";
import StatusChip from "../../components/chip/StatusChip";
import FilterSelect from "../../components/FilterSelect";
import FormField from "../../components/FormField";
import Input from "../../components/Input";
import ItemCard from "../../components/ItemCard";
import SlideModal from "../../components/modal/SlideModal";
import SearchInput from "../../components/SearchInput";

import { rowActionBtnClass, selectClass } from "../../uiClasses";

const CATEGORY_LABEL: Record<TrainingCategory, string> = {
  PRE: "사전",
  DURING: "기간중",
};

const PAY_MODE_LABEL: Record<TrainingPayMode, string> = {
  WORK: "근무시간 합산",
  HOURLY: "시간당 별도지급",
  DAILY: "일당 별도지급",
  NONE: "미지급(기록만)",
};

type SubTab = "definitions" | "logs" | "compliance";

const emptyTrainingForm = {
  name: "",
  category: "" as TrainingCategory | "",
  trainingDate: "",
  isPaid: false,
  payMode: "" as TrainingPayMode | "",
  startTime: "",
  endTime: "",
  dailyWage: "",
  isRequired: false,
};

// 시작/종료 시각(HH:MM)으로부터 교육 시간을 계산한다. 종료가 시작보다 빠르면 무효로 본다.
const computeTrainingHours = (startTime: string, endTime: string): number | undefined => {
  if (!startTime || !endTime) return undefined;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);

  return minutes > 0 ? minutes / 60 : undefined;
};

const emptyLogForm = {
  participantIds: [] as number[],
  trainingId: "",
  attendDate: getLocalToday(),
  attendHours: "",
};

interface TrainingTabPanelProps {
  programId: number;
  participants: Participant[];
  participantIds: Set<number> | null;
}

/**
 * 관리자 페이지 > 근무 관리 페이지의 "교육" 탭 내용입니다.
 * 교육 정의/이수 현황/필수교육 현황 하위 탭 3개.
 */
const TrainingTabPanel = ({ programId, participants, participantIds }: TrainingTabPanelProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>("definitions");

  const [logTrainingFilter, setLogTrainingFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<ProjectTraining | null>(null);
  const [trainingForm, setTrainingForm] = useState(emptyTrainingForm);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logForm, setLogForm] = useState(emptyLogForm);

  // 교육 목록은 "이수 현황" 탭의 필터/모달과 "필수교육 현황" 탭에서도 참조하니 탭과 무관하게 받아둔다.
  const { data: trainings = [] } = useQuery(trainingsQueryOptions(programId));
  const { data: logs = [] } = useQuery(
    trainingLogsQueryOptions(
      programId,
      logTrainingFilter === "all" ? undefined : Number(logTrainingFilter),
      subTab === "logs",
    ),
  );
  const { data: compliance = [] } = useQuery(
    trainingComplianceQueryOptions(programId, subTab === "compliance"),
  );

  // 💡 이수등록 모달에서 선택한 교육을 이미 이수(COMPLETED)한 참여자는 체크박스를
  // 막아서 중복 등록을 예방한다 — 참여자를 먼저 고르고 교육을 나중에 고르는 순서라,
  // 저장 시점에도 한 번 더 걸러야 한다(교육을 나중에 바꿔서 뒤늦게 겹치는 경우).
  const selectedLogTrainingId = logForm.trainingId ? Number(logForm.trainingId) : undefined;
  const { data: selectedTrainingLogs = [] } = useQuery(
    trainingLogsQueryOptions(
      programId,
      selectedLogTrainingId,
      logModalOpen && selectedLogTrainingId !== undefined,
    ),
  );
  // 💡 selectedLogTrainingId가 undefined면 쿼리 키가 "이수 현황" 탭의 "전체 교육"
  // 필터와 같아져서(logsFiltered(programId, undefined)) 그 캐시를 그대로 돌려받을 수
  // 있다 — 교육을 아직 안 고른 상태에서는 그 데이터를 참고하면 안 되니 항상 빈 값으로 본다.
  const alreadyCompletedParticipantIds =
    selectedLogTrainingId === undefined
      ? new Set<number>()
      : new Set(
          selectedTrainingLogs
            .filter((row) => row.log.status === "COMPLETED")
            .map((row) => row.log.participantId),
        );

  const createTrainingMutation = useMutation(createTrainingMutationOptions(queryClient));
  const updateTrainingMutation = useMutation(updateTrainingMutationOptions(queryClient));
  const createTrainingLogMutation = useMutation(createTrainingLogMutationOptions(queryClient));
  const cancelTrainingLogMutation = useMutation(cancelTrainingLogMutationOptions(queryClient));

  const handleAddTrainingButtonClick = () => {
    setEditingTraining(null);
    setTrainingForm(emptyTrainingForm);
    setTrainingModalOpen(true);
  };

  const handleEditTrainingButtonClick = (training: ProjectTraining) => {
    setEditingTraining(training);
    setTrainingForm({
      name: training.name,
      category: training.category,
      trainingDate: training.trainingDate ?? "",
      isPaid: training.isPaid,
      payMode: training.payMode,
      startTime: training.startTime ?? "",
      endTime: training.endTime ?? "",
      dailyWage: training.dailyWage !== null ? String(training.dailyWage) : "",
      isRequired: training.isRequired,
    });
    setTrainingModalOpen(true);
  };

  const handleToggleTrainingActiveButtonClick = (training: ProjectTraining) => {
    const actionLabel = training.isActive ? "비활성화" : "활성화";
    if (!confirm(`'${training.name}' 교육을 ${actionLabel}하시겠습니까?`)) return;
    updateTrainingMutation.mutate(
      { id: training.id, programId, data: { isActive: !training.isActive } },
      {
        onSuccess: () => showToast(`'${training.name}' 교육을 ${actionLabel}했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "처리에 실패했습니다."),
      },
    );
  };

  const handleSaveTrainingButtonClick = () => {
    if (!trainingForm.name) {
      alert("교육명을 입력해주세요.");

      return;
    }
    if (!trainingForm.category || !trainingForm.payMode) {
      alert("구분과 지급방식을 선택해주세요.");

      return;
    }
    const payload = {
      name: trainingForm.name,
      category: trainingForm.category,
      trainingDate: trainingForm.trainingDate || undefined,
      isPaid: trainingForm.isPaid,
      payMode: trainingForm.payMode,
      startTime: trainingForm.startTime || undefined,
      endTime: trainingForm.endTime || undefined,
      hours: computeTrainingHours(trainingForm.startTime, trainingForm.endTime),
      dailyWage: trainingForm.dailyWage ? Number(trainingForm.dailyWage) : undefined,
      isRequired: trainingForm.isRequired,
    };
    const onSettled = {
      onSuccess: () => {
        showToast(`'${trainingForm.name}' 교육을 저장했습니다.`);
        setTrainingModalOpen(false);
      },
      onError: (error: unknown) =>
        alert(error instanceof Error ? error.message : "저장에 실패했습니다."),
    };
    if (editingTraining) {
      updateTrainingMutation.mutate(
        { id: editingTraining.id, programId, data: payload },
        onSettled,
      );
    } else {
      createTrainingMutation.mutate({ programId, ...payload }, onSettled);
    }
  };

  const handleAddLogButtonClick = () => {
    setLogForm(emptyLogForm);
    setLogModalOpen(true);
  };

  const handleParticipantCheckboxChange = (participantId: number) => {
    setLogForm((logForm) => ({
      ...logForm,
      participantIds: logForm.participantIds.includes(participantId)
        ? logForm.participantIds.filter((id) => id !== participantId)
        : [...logForm.participantIds, participantId],
    }));
  };

  const handleSaveLogButtonClick = async () => {
    if (logForm.participantIds.length === 0 || !logForm.trainingId || !logForm.attendDate) {
      alert("참여자, 교육, 이수일자를 입력해주세요.");

      return;
    }

    // 참여자를 고른 뒤 교육을 바꿔서 뒤늦게 이미 이수한 사람이 섞여 있을 수 있어
    // 저장 시점에 한 번 더 걸러낸다.
    const targetParticipantIds = logForm.participantIds.filter(
      (participantId) => !alreadyCompletedParticipantIds.has(participantId),
    );
    const skippedCount = logForm.participantIds.length - targetParticipantIds.length;
    if (targetParticipantIds.length === 0) {
      alert("선택한 참여자가 모두 이미 이수 처리돼 있습니다.");

      return;
    }

    try {
      await Promise.all(
        targetParticipantIds.map((participantId) =>
          createTrainingLogMutation.mutateAsync({
            programId,
            participantId,
            trainingId: Number(logForm.trainingId),
            attendDate: logForm.attendDate,
            attendHours: logForm.attendHours ? Number(logForm.attendHours) : undefined,
          }),
        ),
      );
      showToast(
        skippedCount > 0
          ? `${targetParticipantIds.length}명 등록, 이미 이수한 ${skippedCount}명은 제외했습니다.`
          : `${targetParticipantIds.length}명의 이수 기록을 등록했습니다.`,
      );
      setLogModalOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "등록에 실패했습니다.");
    }
  };

  const handleCancelLogButtonClick = (log: TrainingLogRow) => {
    if (
      !confirm(`'${log.participantName}' 님의 '${log.trainingName}' 이수 기록을 취소하시겠습니까?`)
    )
      return;
    cancelTrainingLogMutation.mutate(
      { logId: log.log.id, programId },
      {
        onSuccess: () => showToast(`'${log.trainingName}' 이수 기록을 취소했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : "취소에 실패했습니다."),
      },
    );
  };

  // 수요처 필터는 상위 페이지가 참여자 id 집합으로 내려준다 (null이면 전체)
  const filteredLogs = logs.filter(
    (row) =>
      row.participantName.includes(logSearch) &&
      (!participantIds || participantIds.has(row.log.participantId)),
  );

  const filteredCompliance = participantIds
    ? compliance.filter((row) => participantIds.has(row.participantId))
    : compliance;

  return (
    <div>
      <SubTabBar
        tabs={[
          ["definitions", "교육 정의"],
          ["logs", "이수 현황"],
          ["compliance", "필수교육 현황"],
        ]}
        active={subTab}
        onChange={setSubTab}
      />

      {subTab === "definitions" && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-sm font-bold">교육 목록 ({trainings.length}건)</span>
            <Button variant="ghost" onClick={handleAddTrainingButtonClick}>
              + 교육 추가
            </Button>
          </div>
          {trainings.length === 0 ? (
            <div className="bg-white border border-admin-border-subtle rounded-[2px] px-5 py-10 text-center text-[13px] text-admin-text-placeholder">
              등록된 교육이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {trainings.map((training) => (
                <ItemCard
                  key={training.id}
                  title={training.name}
                  badge={{
                    variant: training.isActive ? "ok" : "pending",
                    label: training.isActive ? "활성" : "비활성",
                  }}
                  infoLine={
                    <>
                      <div className="text-[13px] text-text-subtle leading-[1.6]">
                        {CATEGORY_LABEL[training.category]} · {PAY_MODE_LABEL[training.payMode]}
                      </div>
                      {(training.trainingDate || (training.startTime && training.endTime)) && (
                        <div className="text-[13.5px] font-bold text-text-strong mt-1.5 mb-3">
                          {training.trainingDate}
                          {training.trainingDate && training.startTime && training.endTime && " "}
                          {training.startTime && training.endTime
                            ? `${training.startTime}~${training.endTime}`
                            : ""}
                        </div>
                      )}
                    </>
                  }
                  size="comfortable"
                  tags={training.isRequired ? ["필수교육"] : undefined}
                  actions={[
                    { label: "수정", onClick: () => handleEditTrainingButtonClick(training) },
                    {
                      label: training.isActive ? "비활성화" : "활성화",
                      onClick: () => handleToggleTrainingActiveButtonClick(training),
                    },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "logs" && (
        <div className="bg-white border border-admin-border-subtle rounded-[2px]">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-faint flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <FilterSelect
                value={logTrainingFilter}
                onChange={setLogTrainingFilter}
                options={[
                  { value: "all", label: "전체 교육" },
                  ...trainings.map((training) => ({
                    value: String(training.id),
                    label: training.name,
                  })),
                ]}
              />
              <SearchInput value={logSearch} onChange={setLogSearch} placeholder="참여자 검색" />
            </div>
            <Button variant="ghost" onClick={handleAddLogButtonClick}>
              + 이수 등록
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] table-fixed border-collapse">
              <thead>
                <tr>
                  <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                    참여자명
                  </th>
                  <th className="w-[180px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                    교육명
                  </th>
                  <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                    이수일자
                  </th>
                  <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                    이수시간
                  </th>
                  <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                    지급액
                  </th>
                  <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                    상태
                  </th>
                  <th className="w-[90px] bg-admin-surface-header border-b border-admin-border-subtle" />
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((row) => (
                  <tr
                    key={row.log.id}
                    className={
                      row.log.status === "CANCELLED"
                        ? "opacity-50 hover:bg-admin-row-hover"
                        : "hover:bg-admin-row-hover"
                    }
                  >
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                      {row.participantName}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                      {row.trainingName}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint whitespace-nowrap">
                      {row.log.attendDate}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                      {row.log.attendHours}시간
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                      {row.log.payAmount.toLocaleString()}원
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                      <StatusChip variant={row.log.status === "COMPLETED" ? "ok" : "bad"}>
                        {row.log.status === "COMPLETED" ? "완료" : "취소됨"}
                      </StatusChip>
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                      {row.log.status === "COMPLETED" && (
                        <button
                          className={rowActionBtnClass}
                          onClick={() => handleCancelLogButtonClick(row)}
                        >
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-[13px] text-admin-text-placeholder"
                    >
                      이수 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "compliance" && (
        <div className="bg-white border border-admin-border-subtle rounded-[2px]">
          <div className="px-5 py-4 border-b border-border-faint">
            <span className="text-sm font-bold">필수교육 미이수자</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] table-fixed border-collapse">
              <thead>
                <tr>
                  <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                    참여자명
                  </th>
                  <th className="text-left text-[11px] font-bold uppercase tracking-wide text-text-subtle bg-admin-surface-header px-5 py-[11px] border-b border-admin-border-subtle">
                    미이수 필수교육
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCompliance.map((row) => (
                  <tr key={row.participantId} className="hover:bg-admin-row-hover">
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                      {row.participantName}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-border-faint">
                      {row.missingTrainings.map((training) => training.name).join(", ")}
                    </td>
                  </tr>
                ))}
                {filteredCompliance.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-5 py-8 text-center text-[13px] text-admin-text-placeholder"
                    >
                      미이수자가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {trainingModalOpen && (
        <SlideModal
          isOpen
          title={editingTraining ? "교육 수정" : "교육 추가"}
          onClose={() => setTrainingModalOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setTrainingModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleSaveTrainingButtonClick}>저장</Button>
            </>
          }
        >
          <FormField label="교육명">
            <Input
              value={trainingForm.name}
              onChange={(event) =>
                setTrainingForm((trainingForm) => ({
                  ...trainingForm,
                  name: event.target.value,
                }))
              }
            />
          </FormField>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="구분">
                <FilterSelect
                  className="w-full"
                  value={trainingForm.category}
                  onChange={(value) =>
                    setTrainingForm((trainingForm) => ({
                      ...trainingForm,
                      category: value as TrainingCategory | "",
                    }))
                  }
                  options={[
                    { value: "", label: "선택하세요" },
                    { value: "PRE", label: "사전" },
                    { value: "DURING", label: "기간중" },
                  ]}
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="지급방식">
                <FilterSelect
                  className="w-full"
                  value={trainingForm.payMode}
                  onChange={(value) =>
                    setTrainingForm((trainingForm) => ({
                      ...trainingForm,
                      payMode: value as TrainingPayMode | "",
                    }))
                  }
                  options={[
                    { value: "", label: "선택하세요" },
                    { value: "NONE", label: "미지급(기록만)" },
                    { value: "WORK", label: "근무시간 합산" },
                    { value: "HOURLY", label: "시간당 별도지급" },
                    { value: "DAILY", label: "일당 별도지급" },
                  ]}
                />
              </FormField>
            </div>
          </div>
          <FormField label="교육날짜(선택)">
            <Input
              type="date"
              value={trainingForm.trainingDate}
              onChange={(event) =>
                setTrainingForm((trainingForm) => ({
                  ...trainingForm,
                  trainingDate: event.target.value,
                }))
              }
            />
          </FormField>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="시작시간(선택)">
                <Input
                  type="time"
                  value={trainingForm.startTime}
                  onChange={(event) =>
                    setTrainingForm((trainingForm) => ({
                      ...trainingForm,
                      startTime: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="종료시간(선택)">
                <Input
                  type="time"
                  value={trainingForm.endTime}
                  onChange={(event) =>
                    setTrainingForm((trainingForm) => ({
                      ...trainingForm,
                      endTime: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </div>
          {trainingForm.payMode === "DAILY" && (
            <FormField label="일당(원)">
              <Input
                type="number"
                value={trainingForm.dailyWage}
                onChange={(event) =>
                  setTrainingForm((trainingForm) => ({
                    ...trainingForm,
                    dailyWage: event.target.value,
                  }))
                }
              />
            </FormField>
          )}
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={trainingForm.isRequired}
              onChange={(event) =>
                setTrainingForm((trainingForm) => ({
                  ...trainingForm,
                  isRequired: event.target.checked,
                }))
              }
            />
            필수 교육
          </label>
        </SlideModal>
      )}

      {logModalOpen && (
        <SlideModal
          isOpen
          title="이수 등록"
          onClose={() => setLogModalOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setLogModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleSaveLogButtonClick}>저장</Button>
            </>
          }
        >
          <FormField label={`참여자 (${logForm.participantIds.length}명 선택됨)`}>
            <div className="w-full max-h-[220px] overflow-y-auto border border-admin-border rounded-[2px]">
              {participants.map((participant) => {
                const isAlreadyCompleted = alreadyCompletedParticipantIds.has(participant.id);

                return (
                  <label
                    key={participant.id}
                    className={`flex items-center gap-2 px-3 py-2 text-[13px] font-sans border-b border-admin-border-subtle last:border-b-0 ${
                      isAlreadyCompleted
                        ? "text-admin-text-faint cursor-not-allowed"
                        : "cursor-pointer hover:bg-admin-surface-hover"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={logForm.participantIds.includes(participant.id)}
                      disabled={isAlreadyCompleted}
                      onChange={() => handleParticipantCheckboxChange(participant.id)}
                    />
                    {participant.name}
                    {isAlreadyCompleted && " · 이미 이수함"}
                  </label>
                );
              })}
            </div>
          </FormField>
          <FormField label="교육">
            <select
              className={`${selectClass} w-full`}
              value={logForm.trainingId}
              onChange={(event) => {
                const selectedTraining = trainings.find(
                  (training) => String(training.id) === event.target.value,
                );
                setLogForm((logForm) => ({
                  ...logForm,
                  trainingId: event.target.value,
                  attendHours:
                    selectedTraining?.hours !== null && selectedTraining?.hours !== undefined
                      ? String(selectedTraining.hours)
                      : logForm.attendHours,
                }));
              }}
            >
              <option value="">선택하세요</option>
              {trainings
                .filter((training) => training.isActive)
                .map((training) => (
                  <option key={training.id} value={training.id}>
                    {training.name}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="이수일자">
            <Input
              type="date"
              value={logForm.attendDate}
              onChange={(event) =>
                setLogForm((logForm) => ({
                  ...logForm,
                  attendDate: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="이수시간(선택, 비우면 교육 기준시간 사용)">
            <Input
              type="number"
              value={logForm.attendHours}
              onChange={(event) =>
                setLogForm((logForm) => ({
                  ...logForm,
                  attendHours: event.target.value,
                }))
              }
            />
          </FormField>
        </SlideModal>
      )}
    </div>
  );
};

export default TrainingTabPanel;
