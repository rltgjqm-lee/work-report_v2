import { useEffect, useState } from "react";

import {
  cancelTrainingLog,
  createTraining,
  createTrainingLog,
  getTrainingSummary,
  listTrainingLogs,
  listTrainings,
  updateTraining,
} from "../../api/admin/trainings";
import FilterSelect from "../../components/FilterSelect";
import ItemCard from "../../components/ItemCard";
import SearchInput from "../../components/SearchInput";
import SlideModal from "../../components/modal/SlideModal";
import FormField from "../../components/FormField";
import StatusChip from "../../components/chip/StatusChip";
import SubTabBar from "../../components/bar/SubTabBar";
import { getLocalToday } from "../../../utils/timeFormat";
import {
  btnGhostClass,
  btnPrimaryClass,
  inputClass,
  rowActionBtnClass,
  selectClass,
} from "../../uiClasses";
import type {
  Participant,
  ProjectTraining,
  TrainingCategory,
  TrainingLogRow,
  TrainingPayMode,
  TrainingSummaryRow,
} from "../../types";

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

type SubTab = "definitions" | "logs" | "summary";

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
  participantId: "",
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
 * 관리자 페이지 > 근태 관리 페이지의 "교육" 탭 내용입니다.
 * 교육 정의/이수 현황/필수교육 현황 하위 탭 3개.
 */
const TrainingTabPanel = ({ programId, participants, participantIds }: TrainingTabPanelProps) => {
  const [subTab, setSubTab] = useState<SubTab>("definitions");

  const [trainings, setTrainings] = useState<ProjectTraining[]>([]);
  const [logs, setLogs] = useState<TrainingLogRow[]>([]);
  const [summary, setSummary] = useState<TrainingSummaryRow[]>([]);
  const [logTrainingFilter, setLogTrainingFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<ProjectTraining | null>(null);
  const [trainingForm, setTrainingForm] = useState(emptyTrainingForm);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logForm, setLogForm] = useState(emptyLogForm);

  const refreshTrainings = () => {
    listTrainings(programId).then(setTrainings);
  };

  const refreshLogs = () => {
    listTrainingLogs(
      programId,
      logTrainingFilter === "all" ? undefined : Number(logTrainingFilter),
    ).then(setLogs);
  };

  const refreshSummary = () => {
    getTrainingSummary(programId).then(setSummary);
  };

  useEffect(refreshTrainings, [programId]);
  useEffect(refreshLogs, [programId, logTrainingFilter]);
  useEffect(refreshSummary, [programId]);

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

  const handleToggleTrainingActiveButtonClick = async (training: ProjectTraining) => {
    const actionLabel = training.isActive ? "비활성화" : "활성화";
    if (!confirm(`'${training.name}' 교육을 ${actionLabel}하시겠습니까?`)) return;
    try {
      await updateTraining(training.id, { isActive: !training.isActive });
      refreshTrainings();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleSaveTrainingButtonClick = async () => {
    if (!trainingForm.name) {
      alert("교육명을 입력해주세요.");

      return;
    }
    if (!trainingForm.category || !trainingForm.payMode) {
      alert("구분과 지급방식을 선택해주세요.");

      return;
    }
    try {
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
      if (editingTraining) {
        await updateTraining(editingTraining.id, payload);
      } else {
        await createTraining({ programId, ...payload });
      }
      setTrainingModalOpen(false);
      refreshTrainings();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const handleAddLogButtonClick = () => {
    setLogForm(emptyLogForm);
    setLogModalOpen(true);
  };

  const handleSaveLogButtonClick = async () => {
    if (!logForm.participantId || !logForm.trainingId || !logForm.attendDate) {
      alert("참여자, 교육, 이수일자를 입력해주세요.");

      return;
    }
    try {
      await createTrainingLog({
        participantId: Number(logForm.participantId),
        trainingId: Number(logForm.trainingId),
        attendDate: logForm.attendDate,
        attendHours: logForm.attendHours ? Number(logForm.attendHours) : undefined,
      });
      setLogModalOpen(false);
      refreshLogs();
    } catch (error) {
      alert(error instanceof Error ? error.message : "등록에 실패했습니다.");
    }
  };

  const handleCancelLogButtonClick = async (log: TrainingLogRow) => {
    if (
      !confirm(`'${log.participantName}' 님의 '${log.trainingName}' 이수 기록을 취소하시겠습니까?`)
    )
      return;
    try {
      await cancelTrainingLog(log.log.id);
      refreshLogs();
    } catch (error) {
      alert(error instanceof Error ? error.message : "취소에 실패했습니다.");
    }
  };

  // 수요처 필터는 상위 페이지가 참여자 id 집합으로 내려준다 (null이면 전체)
  const filteredLogs = logs.filter(
    (row) =>
      row.participantName.includes(logSearch) &&
      (!participantIds || participantIds.has(row.log.participantId)),
  );

  const filteredSummary = participantIds
    ? summary.filter((row) => participantIds.has(row.participantId))
    : summary;

  return (
    <div>
      <SubTabBar
        tabs={[
          ["definitions", "교육 정의"],
          ["logs", "이수 현황"],
          ["summary", "필수교육 현황"],
        ]}
        active={subTab}
        onChange={setSubTab}
      />

      {subTab === "definitions" && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-sm font-bold">교육 목록 ({trainings.length}건)</span>
            <button className={btnGhostClass} onClick={handleAddTrainingButtonClick}>
              + 교육 추가
            </button>
          </div>
          {trainings.length === 0 ? (
            <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-10 text-center text-[13px] text-[#9aa1ab]">
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
                      <div className="text-[13px] text-[#6b7280] leading-[1.6]">
                        {CATEGORY_LABEL[training.category]} · {PAY_MODE_LABEL[training.payMode]}
                      </div>
                      {(training.trainingDate || (training.startTime && training.endTime)) && (
                        <div className="text-[13.5px] font-bold text-[#1f2937] mt-1.5 mb-3">
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
        <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
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
            <button className={btnGhostClass} onClick={handleAddLogButtonClick}>
              + 이수 등록
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] table-fixed border-collapse">
              <thead>
                <tr>
                  <th className="w-[120px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    참여자명
                  </th>
                  <th className="w-[180px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    교육명
                  </th>
                  <th className="w-[110px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    이수일자
                  </th>
                  <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    이수시간
                  </th>
                  <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    지급액
                  </th>
                  <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    상태
                  </th>
                  <th className="w-[90px] bg-[#f7f8fa] border-b border-[#e2e5eb]" />
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((row) => (
                  <tr
                    key={row.log.id}
                    className={
                      row.log.status === "CANCELLED"
                        ? "opacity-50 hover:bg-[#f8fafc]"
                        : "hover:bg-[#f8fafc]"
                    }
                  >
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                      {row.participantName}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                      {row.trainingName}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                      {row.log.attendDate}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                      {row.log.attendHours}시간
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                      {row.log.payAmount.toLocaleString()}원
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                      <StatusChip variant={row.log.status === "COMPLETED" ? "ok" : "bad"}>
                        {row.log.status === "COMPLETED" ? "완료" : "취소됨"}
                      </StatusChip>
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
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
                    <td colSpan={7} className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]">
                      이수 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "summary" && (
        <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
          <div className="px-5 py-4 border-b border-[#eceef1]">
            <span className="text-sm font-bold">필수교육 미이수자</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] table-fixed border-collapse">
              <thead>
                <tr>
                  <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    참여자명
                  </th>
                  <th className="text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                    미이수 필수교육
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSummary.map((row) => (
                  <tr key={row.participantId} className="hover:bg-[#f8fafc]">
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                      {row.participantName}
                    </td>
                    <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                      {row.missingTrainings.map((training) => training.name).join(", ")}
                    </td>
                  </tr>
                ))}
                {filteredSummary.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]">
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
              <button className={btnGhostClass} onClick={() => setTrainingModalOpen(false)}>
                취소
              </button>
              <button className={btnPrimaryClass} onClick={handleSaveTrainingButtonClick}>
                저장
              </button>
            </>
          }
        >
          <FormField label="교육명">
            <input
              className={inputClass}
              value={trainingForm.name}
              onChange={(event) =>
                setTrainingForm((f) => ({
                  ...f,
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
                    setTrainingForm((f) => ({
                      ...f,
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
                    setTrainingForm((f) => ({
                      ...f,
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
            <input
              type="date"
              className={inputClass}
              value={trainingForm.trainingDate}
              onChange={(event) =>
                setTrainingForm((f) => ({
                  ...f,
                  trainingDate: event.target.value,
                }))
              }
            />
          </FormField>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="시작시간(선택)">
                <input
                  type="time"
                  className={inputClass}
                  value={trainingForm.startTime}
                  onChange={(event) =>
                    setTrainingForm((f) => ({
                      ...f,
                      startTime: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="종료시간(선택)">
                <input
                  type="time"
                  className={inputClass}
                  value={trainingForm.endTime}
                  onChange={(event) =>
                    setTrainingForm((f) => ({
                      ...f,
                      endTime: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </div>
          {trainingForm.payMode === "DAILY" && (
            <FormField label="일당(원)">
              <input
                type="number"
                className={inputClass}
                value={trainingForm.dailyWage}
                onChange={(event) =>
                  setTrainingForm((f) => ({
                    ...f,
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
                setTrainingForm((f) => ({
                  ...f,
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
              <button className={btnGhostClass} onClick={() => setLogModalOpen(false)}>
                취소
              </button>
              <button className={btnPrimaryClass} onClick={handleSaveLogButtonClick}>
                저장
              </button>
            </>
          }
        >
          <FormField label="참여자">
            <select
              className={selectClass}
              value={logForm.participantId}
              onChange={(event) =>
                setLogForm((f) => ({
                  ...f,
                  participantId: event.target.value,
                }))
              }
            >
              <option value="">선택하세요</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="교육">
            <select
              className={selectClass}
              value={logForm.trainingId}
              onChange={(event) =>
                setLogForm((f) => ({
                  ...f,
                  trainingId: event.target.value,
                }))
              }
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
            <input
              type="date"
              className={inputClass}
              value={logForm.attendDate}
              onChange={(event) =>
                setLogForm((f) => ({
                  ...f,
                  attendDate: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="이수시간(선택, 비우면 교육 기준시간 사용)">
            <input
              type="number"
              className={inputClass}
              value={logForm.attendHours}
              onChange={(event) =>
                setLogForm((f) => ({
                  ...f,
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
