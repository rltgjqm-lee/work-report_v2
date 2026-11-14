import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Info } from "lucide-react";

import { mobileZoneDetailQueryOptions } from "@work-report/admin-core/api/mobile";
import type { MobileZoneMember, MobileZoneMemberState } from "@work-report/admin-core/api/mobile";

import Card from "../components/atoms/Card";
import StatusChip from "../components/atoms/StatusChip";
import type { ChipTone } from "../components/atoms/StatusChip";
import DetailHeader from "../components/molecule/DetailHeader";
import HeaderStats from "../components/molecule/HeaderStats";
import InfoRows from "../components/molecule/InfoRows";
import SafetyMap from "../components/organism/SafetyMap";
import type { MapPoint } from "../components/organism/SafetyMap";
import { formatMeters } from "../lib/format";
import { areaLabel } from "../lib/zones";

const MEMBER_STATES: Record<MobileZoneMemberState, { label: string; tone: ChipTone }> = {
  INSIDE: { label: "구역 안", tone: "ok" },
  ESCAPE: { label: "이탈", tone: "escape" },
  UNCERTAIN: { label: "확인 중", tone: "muted" },
  NOT_CLOCKED_IN: { label: "미출근", tone: "muted" },
  CLOCKED_OUT: { label: "퇴근", tone: "muted" },
};

const POINT_TONES: Partial<Record<MobileZoneMemberState, MapPoint["tone"]>> = {
  INSIDE: "inside",
  ESCAPE: "escape",
  UNCERTAIN: "muted",
};

const memberNote = (member: MobileZoneMember) => {
  if (member.state === "NOT_CLOCKED_IN") return "아직 출근 전이에요";
  if (member.state === "CLOCKED_OUT")
    return `${member.clockInTime} 출근 · ${member.clockOutTime} 퇴근`;
  if (member.state === "ESCAPE" && member.outsideM) {
    return `${member.clockInTime} 출근 · 구역 밖 ${formatMeters(member.outsideM)}`;
  }
  if (member.state === "UNCERTAIN")
    return `${member.clockInTime} 출근 · 위치 오차가 커서 판정 보류`;
  return `${member.clockInTime} 출근`;
};

const ZoneDetailPage = () => {
  const [searchParams] = useSearchParams();
  const zoneId = Number(searchParams.get("id"));
  const {
    data: detail,
    isPending,
    isError,
    error,
  } = useQuery(mobileZoneDetailQueryOptions(zoneId));

  if (isPending || isError || !detail) {
    return (
      <div className="flex min-h-full flex-col">
        <DetailHeader title="구역 상세" fallbackPath="/zones" />
        <p
          className={`p-10 text-center text-sm font-bold ${isError ? "text-sos-ink" : "text-ink-muted"}`}
        >
          {isError
            ? error instanceof Error
              ? error.message
              : "불러오지 못했어요."
            : "불러오는 중..."}
        </p>
      </div>
    );
  }

  const { zone, areas, members, escapeTodayCount } = detail;
  const points: MapPoint[] = members.flatMap((member) => {
    const tone = POINT_TONES[member.state];
    if (!tone || member.lat === null || member.lng === null) return [];
    return [{ lat: member.lat, lng: member.lng, tone, label: member.name }];
  });

  return (
    <div className="flex min-h-full flex-col">
      <DetailHeader title="구역 상세" fallbackPath="/zones">
        <div>
          <div className="flex items-center gap-2">
            <span className="truncate text-[26px] font-extrabold text-white">{zone.name}</span>
            {zone.escapeCount > 0 && (
              <span className="flex-none rounded-full bg-escape px-3 py-1 text-xs font-extrabold text-white">
                이탈 {zone.escapeCount}명
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-normal font-semibold text-white/85">
            {zone.address ?? "주소 없음"}
            <br />
            {zone.programName}
          </p>
        </div>
        <HeaderStats
          stats={[
            { label: "배치 인원", value: `${zone.assignedCount}명` },
            { label: "근무 중", value: `${zone.workingCount}명` },
            { label: "오늘 이탈", value: `${escapeTodayCount}건` },
          ]}
        />
      </DetailHeader>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <Card className="flex flex-col gap-3 p-3">
          {areas.length > 0 ? (
            <SafetyMap
              areas={areas}
              points={points}
              ariaLabel={`${zone.name} 관제 구역 지도 — ${areaLabel(zone)}`}
              className="h-64"
            />
          ) : (
            <p className="rounded-[14px] bg-soft px-4 py-6 text-center text-sm font-bold text-ink-muted">
              아직 관제 구역이 없어요. PC에서 반경이나 다각형을 그려주세요.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1.5 pb-1 text-[13px] font-bold text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-ok" aria-hidden="true" />
              구역 안
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-escape" aria-hidden="true" />
              이탈
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-ink-faint" aria-hidden="true" />
              판정 보류
            </span>
          </div>
        </Card>

        <InfoRows
          rows={[
            { label: "관제 범위", value: areaLabel(zone) },
            { label: "근무시간", value: zone.scheduleLabel ?? "미설정" },
          ]}
        />

        <h2 className="mt-1 text-lg font-extrabold text-ink">배치 인원 {members.length}명</h2>
        <Card className="flex flex-col px-[18px] py-1.5">
          {members.length === 0 ? (
            <p className="py-5 text-center text-sm font-bold text-ink-muted">
              배치된 참여자가 없어요
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.participantId}
                className="flex items-center gap-3 border-b-[1.5px] border-soft py-3.5 last:border-b-0"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-page text-base font-extrabold text-ink-sub">
                  {member.name.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold text-ink">
                    {member.name}
                    {member.groupName && (
                      <span className="ml-1.5 text-[13px] font-bold text-ink-muted">
                        {member.groupName}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[13px] font-bold text-ink-muted">
                    {memberNote(member)}
                  </span>
                </span>
                <StatusChip tone={MEMBER_STATES[member.state].tone}>
                  {MEMBER_STATES[member.state].label}
                </StatusChip>
              </div>
            ))
          )}
        </Card>

        <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-[13px] font-bold text-ink-muted">
          <Info size={16} className="flex-none" aria-hidden="true" />
          관제 범위·근무시간 변경은 관리자 PC에서 할 수 있어요
        </p>
      </div>
    </div>
  );
};

export default ZoneDetailPage;
