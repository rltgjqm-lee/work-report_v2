import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  bulkCorrectAttendanceMutationOptions,
  type BulkAttendanceTarget,
  type BulkCorrectAttendanceVariables,
} from "@work-report/admin-core/api/attendance";

import { useToast } from "../../context/useToast";

import Button from "../../components/Button";
import Input from "../../components/Input";

import { selectClass } from "../../uiClasses";

export type BulkAttendanceCorrectionTarget = BulkAttendanceTarget & { participantName: string };

type BulkForm = Omit<BulkCorrectAttendanceVariables["data"], "targets" | "clockIn" | "clockOut"> & {
  clockIn: string;
  clockOut: string;
};

interface BulkAttendanceCorrectionModalProps {
  programId: number;
  month: string;
  targets: BulkAttendanceCorrectionTarget[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * 관리자 페이지 > 근무 관리 > 근무 탭에서 미출근 행이나 여러 행을 한 번에 고치는 모달입니다.
 * 기록이 있는 행은 수정, 없는 행(미출근)은 새로 등록됩니다.
 */
const BulkAttendanceCorrectionModal = ({
  programId,
  month,
  targets,
  onClose,
  onSaved,
}: BulkAttendanceCorrectionModalProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState<BulkForm>({
    timeMode: "SHIFT",
    clockIn: "",
    clockOut: "",
    status: "NORMAL",
    reason: "",
  });
  const bulkCorrectAttendanceMutation = useMutation(
    bulkCorrectAttendanceMutationOptions(queryClient),
  );

  const title =
    targets.length === 1
      ? `${targets[0].participantName} — ${targets[0].workDate} 근무 수정`
      : `선택한 ${targets.length}건 일괄 수정`;

  const handleSaveButtonClick = () => {
    if (form.timeMode === "CUSTOM" && !form.clockIn) {
      alert("출근시간을 입력해주세요.");
      return;
    }
    if (!form.reason.trim()) {
      alert("수정 사유를 입력해주세요.");
      return;
    }
    bulkCorrectAttendanceMutation.mutate(
      {
        programId,
        month,
        data: {
          targets: targets.map(({ participantId, workDate }) => ({ participantId, workDate })),
          timeMode: form.timeMode,
          clockIn: form.timeMode === "CUSTOM" ? form.clockIn : undefined,
          clockOut: form.timeMode === "CUSTOM" ? form.clockOut || undefined : undefined,
          status: form.status,
          reason: form.reason.trim(),
        },
      },
      {
        onSuccess: ({ createdCount, updatedCount, skipped }) => {
          showToast(`근무 기록 ${createdCount}건 등록, ${updatedCount}건 수정했습니다.`);
          if (skipped.length > 0) {
            const nameById = new Map(
              targets.map((target) => [target.participantId, target.participantName]),
            );
            alert(
              [
                `${skipped.length}건은 처리하지 못했습니다.`,
                ...skipped.map(
                  (skip) =>
                    `- ${nameById.get(skip.participantId) ?? skip.participantId} ${skip.workDate}: ${skip.reason}`,
                ),
              ].join("\n"),
            );
          }
          onSaved();
        },
        onError: (error) => alert(error instanceof Error ? error.message : "수정에 실패했습니다."),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,32,0.45)] z-[2000] flex items-center justify-center">
      <div className="bg-white rounded-[8px] shadow-xl w-[400px] p-5">
        <div className="text-[14px] font-bold mb-2">{title}</div>
        {targets.length > 1 && (
          <div className="text-[12px] text-text-subtle mb-4 max-h-[72px] overflow-auto">
            {targets
              .map((target) => `${target.participantName}(${target.workDate.slice(5)})`)
              .join(", ")}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-admin-text-secondary mb-1">
              출퇴근 시간
            </label>
            <select
              className={selectClass}
              value={form.timeMode}
              onChange={(event) =>
                setForm((form) => ({
                  ...form,
                  timeMode: event.target.value as BulkForm["timeMode"],
                }))
              }
            >
              <option value="SHIFT">조 근무시간대로 (사람마다 그날 조 시간)</option>
              <option value="CUSTOM">직접 입력 (모두 같은 시간)</option>
            </select>
          </div>
          {form.timeMode === "CUSTOM" && (
            <>
              <div>
                <label className="block text-[12px] font-semibold text-admin-text-secondary mb-1">
                  출근시간
                </label>
                <Input
                  type="time"
                  value={form.clockIn}
                  onChange={(event) =>
                    setForm((form) => ({ ...form, clockIn: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-admin-text-secondary mb-1">
                  퇴근시간
                </label>
                <Input
                  type="time"
                  value={form.clockOut}
                  onChange={(event) =>
                    setForm((form) => ({ ...form, clockOut: event.target.value }))
                  }
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-[12px] font-semibold text-admin-text-secondary mb-1">
              상태
            </label>
            <select
              className={selectClass}
              value={form.status}
              onChange={(event) =>
                setForm((form) => ({ ...form, status: event.target.value as BulkForm["status"] }))
              }
            >
              <option value="NORMAL">정상</option>
              <option value="LATE">지각</option>
              <option value="EARLY_LEAVE">조퇴</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-admin-text-secondary mb-1">
              수정 사유 (필수)
            </label>
            <Input
              value={form.reason}
              placeholder="예: 단체 교육 진행"
              onChange={(event) => setForm((form) => ({ ...form, reason: event.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={handleSaveButtonClick}
            disabled={bulkCorrectAttendanceMutation.isPending}
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BulkAttendanceCorrectionModal;
