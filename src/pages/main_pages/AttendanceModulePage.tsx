import { useEffect, useMemo, useState } from "react";

import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import Card from "../../components/atoms/Card";
import Dropdown from "../../components/molecule/Dropdown";
import Button from "../../components/atoms/Button";
import BottomBar from "../../components/atoms/BottomBar";
import {
  pageClass,
  bodyClass,
  labelClass,
} from "../../components/atoms/classes";
import {
  clockIn,
  clockOut,
  updateClockIn,
  updateClockOut,
} from "../../utils/attendanceApi";
import { formatTimeField, isoToTimeParts } from "../../utils/timeFormat";

type AttendanceMode = "in" | "out";

const MODE_LABEL: Record<AttendanceMode, string> = { in: "출근", out: "퇴근" };

interface AttendanceModulePageProps {
  mode: AttendanceMode;
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSave: () => Promise<void>; // 💡 IndexedDB 임시저장 브릿지
  onHome: () => void;
  onAlert: (messages: string[]) => void;
}

/**
 * 출근/퇴근 모듈 — 처음 누르면 현재 시각으로 즉시 서버에 자동 기록되고, 이미
 * 기록된 뒤에는 시/분을 직접 골라 고칠 수 있는 화면으로 바뀐다.
 */
const AttendanceModulePage = ({
  mode,
  formData,
  setFormData,
  onBack,
  onSave,
  onHome,
  onAlert,
}: AttendanceModulePageProps) => {
  const timeField = mode === "in" ? "startTime" : "endTime";
  const recordedTime = formData[timeField];
  const isRecorded = recordedTime.hour !== "";

  const [editing, setEditing] = useState(false);
  const [draftTime, setDraftTime] = useState(recordedTime);
  const [submitting, setSubmitting] = useState(false);
  // 💡 setFormData 직후 곧바로 onSave()를 부르면 onSave가 아직 갱신 전 formData를
  // 클로저로 물고 있어서 방금 기록한 시각이 아니라 이전 값을 저장해버린다. 상태
  // 반영 → Main.tsx 재렌더 → 새 onSave 전달까지 기다렸다가 effect에서 저장한다.
  const [pendingSave, setPendingSave] = useState(false);

  useEffect(() => {
    // onHome()이 곧바로 이 화면을 언마운트시키므로 pendingSave를 다시 false로
    // 되돌릴 필요가 없다(되돌리면 setState-in-effect 린트 규칙에 걸린다).
    if (!pendingSave) return;
    // 💡 저장 완료 알럿을 확인(OK)하기 전까지는 홈으로 넘어가지 않도록 await로 순서를 보장한다.
    (async () => {
      await onSave();
      onHome();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSave]);

  const hourOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    [],
  );
  const minuteOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => String(i * 10).padStart(2, "0")),
    [],
  );

  const handleRegisterButtonClick = async () => {
    if (!formData.participantId) return;
    setSubmitting(true);
    try {
      const iso =
        mode === "in"
          ? (await clockIn(formData.participantId)).clockIn
          : (await clockOut(formData.participantId)).clockOut;
      setFormData((prev) => ({ ...prev, [timeField]: isoToTimeParts(iso) }));
      setPendingSave(true);
    } catch (error) {
      onAlert([
        error instanceof Error
          ? error.message
          : `${MODE_LABEL[mode]} 등록에 실패했습니다.`,
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSaveButtonClick = async () => {
    if (!formData.participantId) return;
    setSubmitting(true);
    try {
      const time = formatTimeField(draftTime);
      if (mode === "in") {
        await updateClockIn(formData.participantId, time);
      } else {
        await updateClockOut(formData.participantId, time);
      }
      setFormData((prev) => ({ ...prev, [timeField]: draftTime }));
      setPendingSave(true);
    } catch (error) {
      onAlert([
        error instanceof Error
          ? error.message
          : `${MODE_LABEL[mode]} 시각 수정에 실패했습니다.`,
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={pageClass}>
      <AppBar title={`${MODE_LABEL[mode]} 등록`} onBack={onBack} />
      <div className={bodyClass}>
        {!isRecorded && (
          <Card>
            <p className="text-[16px] leading-relaxed font-medium text-[#1f2937]">
              지금 시각으로 {MODE_LABEL[mode]}이(가) 기록됩니다.
            </p>
            <Button
              variant="primary"
              disabled={submitting}
              onClick={handleRegisterButtonClick}
            >
              {submitting ? "등록 중..." : `${MODE_LABEL[mode]} 등록`}
            </Button>
          </Card>
        )}

        {isRecorded && !editing && (
          <Card>
            <p className="text-[16px] leading-relaxed font-medium text-[#1f2937]">
              {MODE_LABEL[mode]} 시각:{" "}
              <strong className="text-[#3182f6] font-extrabold">
                {formatTimeField(recordedTime)}
              </strong>
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setDraftTime(recordedTime);
                setEditing(true);
              }}
            >
              시각 수정
            </Button>
          </Card>
        )}

        {isRecorded && editing && (
          <Card>
            <label className={labelClass}>{MODE_LABEL[mode]} 시각 수정</label>
            <div className="flex gap-2">
              <Dropdown
                value={draftTime.ampm}
                onChange={(value) =>
                  setDraftTime((prev) => ({
                    ...prev,
                    ampm: value as "AM" | "PM",
                  }))
                }
                options={[
                  { value: "AM", label: "오전" },
                  { value: "PM", label: "오후" },
                ]}
              />
              <Dropdown
                value={draftTime.hour}
                onChange={(value) =>
                  setDraftTime((prev) => ({ ...prev, hour: value }))
                }
                options={hourOptions.map((hour) => ({
                  value: hour,
                  label: `${hour}시`,
                }))}
              />
              <Dropdown
                value={draftTime.minute}
                onChange={(value) =>
                  setDraftTime((prev) => ({ ...prev, minute: value }))
                }
                options={minuteOptions.map((minute) => ({
                  value: minute,
                  label: `${minute}분`,
                }))}
              />
            </div>
          </Card>
        )}
      </div>

      {isRecorded && editing && (
        <BottomBar>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={handleEditSaveButtonClick}
          >
            {submitting ? "저장 중..." : "저장"}
          </Button>
        </BottomBar>
      )}
    </div>
  );
};

export default AttendanceModulePage;
