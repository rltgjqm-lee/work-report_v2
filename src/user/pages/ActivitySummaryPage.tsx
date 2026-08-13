import type { ActivityLogFormData } from "../../types/form";
import { formatTimeField, getLocalToday } from "../../utils/timeFormat";

import Button from "../../components/atoms/Button";
import { bodyClass, pageClass } from "../../components/atoms/classes";

import BottomBar, { BottomBarRow } from "../components/atoms/BottomBar";
import Card from "../components/atoms/Card";
import AppBar from "../components/molecule/AppBar";

interface ActivitySummaryPageProps {
  formData: ActivityLogFormData;
  onBack: () => void;
  onNext: () => void;
}

const SummaryRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-[13px] border-b border-surface-page last:border-b-0 text-[15px]">
    <div className="flex items-center gap-3 min-w-0">
      <img src={icon} alt="" className="w-8 h-8 flex-none" />
      <span className="text-text-muted font-bold flex-none">{label}</span>
    </div>
    <span className="text-text-strong font-extrabold text-right">{value}</span>
  </div>
);

/**
 * Canvas "6. 전체 확인" — 오늘의 모듈별 기록을 요약해 보여주고 서명 페이지로 안내한다.
 * 공익활동은 업무/안전 항목도 같이 보여주고, 역량활동은 출근/퇴근만 보여준다.
 */
const ActivitySummaryPage = ({ formData, onBack, onNext }: ActivitySummaryPageProps) => {
  const isCompetencyProgram = formData.programType === "역량 활동";
  const todayLabel = getLocalToday().replaceAll("-", ".");

  return (
    <div className={pageClass}>
      <AppBar title="오늘의 활동 요약" onBack={onBack} />
      <div className={bodyClass}>
        <div className="bg-white rounded-[18px] px-[22px] py-5 shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[13px] text-text-muted font-bold mb-3.5">
            {todayLabel} · {formData.userName}님, 안녕하세요
          </div>
          <div className="text-[19px] font-extrabold text-text-strong">오늘 활동을 마쳤어요</div>
          <div className="text-[15px] text-text-tertiary font-semibold mt-1.5">
            아래 내용을 확인하고 서명해주세요.
          </div>
        </div>

        <Card>
          <SummaryRow
            icon="/icons/icon-checkin-clock.png"
            label="출근 시각"
            value={
              formData.startTime.hour ? `${formatTimeField(formData.startTime)} 완료` : "아직이에요"
            }
          />
          {!isCompetencyProgram && (
            <>
              <SummaryRow
                icon="/icons/icon-task.png"
                label="활동 내역"
                value={formData.actContent || "미등록"}
              />
              <SummaryRow
                icon="/icons/icon-map.png"
                label="활동 장소"
                value={formData.actPlace || "미등록"}
              />
              <SummaryRow
                icon="/icons/icon-safety.png"
                label="사고 유무"
                value={
                  !formData.accidentChecked
                    ? "미확인"
                    : formData.hasAccident
                      ? "있었습니다"
                      : "없었습니다"
                }
              />
            </>
          )}
          <SummaryRow
            icon="/icons/icon-checkout-clock.png"
            label="퇴근 시각"
            value={
              formData.endTime.hour ? `${formatTimeField(formData.endTime)} 완료` : "아직이에요"
            }
          />
        </Card>
      </div>

      <BottomBar>
        <BottomBarRow>
          <Button variant="outline" onClick={onBack}>
            이전
          </Button>
          <Button variant="primary" className="flex-1" onClick={onNext}>
            서명하러 가기
          </Button>
        </BottomBarRow>
      </BottomBar>
    </div>
  );
};

export default ActivitySummaryPage;
