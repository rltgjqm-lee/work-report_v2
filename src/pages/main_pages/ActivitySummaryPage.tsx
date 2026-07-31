import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import Card from "../../components/atoms/Card";
import BottomBar, { BottomBarRow } from "../../components/atoms/BottomBar";
import Button from "../../components/atoms/Button";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { formatTimeField } from "../../utils/timeFormat";

interface ActivitySummaryPageProps {
  formData: ActivityLogFormData;
  onBack: () => void;
  onNext: () => void;
}

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 py-[13px] border-b border-[#f2f4f6] last:border-b-0 text-[15px]">
    <span className="text-[#9ca3af] font-bold flex-none">{label}</span>
    <span className="text-[#1f2937] font-extrabold text-right">{value}</span>
  </div>
);

/**
 * Canvas "6. 전체 확인" — 오늘의 모듈별 기록을 요약해 보여주고 서명 페이지로 안내한다.
 * 공익활동은 업무/안전 항목도 같이 보여주고, 역량활동은 출근/퇴근만 보여준다.
 */
const ActivitySummaryPage = ({ formData, onBack, onNext }: ActivitySummaryPageProps) => {
  const isCompetencyProgram = formData.programType === "역량 활동";

  return (
    <div className={pageClass}>
      <AppBar title="오늘의 활동 요약" onBack={onBack} />
      <div className={bodyClass}>
        <Card>
          <SummaryRow
            label="출근 시각"
            value={
              formData.startTime.hour ? `${formatTimeField(formData.startTime)} 완료` : "아직이에요"
            }
          />
          {!isCompetencyProgram && (
            <>
              <SummaryRow label="활동 내역" value={formData.actContent || "미등록"} />
              <SummaryRow label="활동 장소" value={formData.actPlace || "미등록"} />
              <SummaryRow
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
