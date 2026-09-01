interface LocationTrackingStatusBannerProps {
  // 관제구역을 벗어난 상태면 그 수요처명, 아니면 null
  escapedDemandSiteName: string | null;
  reportFailing: boolean;
}

// 근무 중 위치 관제 상태 배너 — 이탈이 더 급한 정보라 둘 다일 때는 이탈만 보여준다.
// 레이아웃을 밀지 않도록 화면 아래에 떠 있게 둔다.
const LocationTrackingStatusBanner = ({
  escapedDemandSiteName,
  reportFailing,
}: LocationTrackingStatusBannerProps) => {
  if (escapedDemandSiteName !== null) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-50 px-4 py-3 bg-danger-tint border-t border-caution-border-subtle text-[13.5px] font-bold text-danger-text-strong">
        ⚠️ {escapedDemandSiteName} 활동 구역을 벗어났어요 — 근무지로 돌아가주세요
      </div>
    );
  }

  if (reportFailing) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-50 px-4 py-3 bg-caution-bg border-t border-caution-border text-[13.5px] font-bold text-caution-text">
        위치가 전송되지 않고 있어요 — 위치 권한과 네트워크를 확인해주세요
      </div>
    );
  }

  return null;
};

export default LocationTrackingStatusBanner;
