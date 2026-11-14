import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Search } from "lucide-react";

import { mobileZonesQueryOptions } from "@work-report/admin-core/api/mobile";
import type { MobileZone } from "@work-report/admin-core/api/mobile";

import StatusChip from "../components/atoms/StatusChip";
import HeaderStats from "../components/molecule/HeaderStats";
import { areaLabel, hasArea } from "../lib/zones";

type ZoneFilter = "all" | "escape" | "noSchedule" | "noArea";

const ZONE_FILTERS: { id: ZoneFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "escape", label: "이탈 발생" },
  { id: "noSchedule", label: "시간 미설정" },
  { id: "noArea", label: "구역 미설정" },
];

const matchesFilter = (zone: MobileZone, filter: ZoneFilter) => {
  if (filter === "escape") return zone.escapeCount > 0;
  if (filter === "noSchedule") return zone.scheduleLabel === null;
  if (filter === "noArea") return !hasArea(zone);
  return true;
};

const ZoneCard = ({ zone }: { zone: MobileZone }) => {
  const statusChip = !hasArea(zone) ? (
    <StatusChip tone="muted">구역 미설정</StatusChip>
  ) : zone.escapeCount > 0 ? (
    <StatusChip tone="escape">{`이탈 ${zone.escapeCount}명`}</StatusChip>
  ) : (
    <StatusChip tone="ok">관제 중</StatusChip>
  );

  return (
    <Link
      to={`/zone?id=${zone.id}`}
      className="flex flex-col gap-3 rounded-[18px] bg-white px-[18px] py-4 shadow-[0_2px_8px_rgba(20,30,50,.05)]"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[17px] font-extrabold text-ink">{zone.name}</span>
          {statusChip}
        </div>
        <span className="truncate text-[13px] font-semibold text-ink-muted">
          {zone.programName}
        </span>
      </div>
      <div className="flex gap-2">
        {[
          { label: "배치 인원", value: `${zone.assignedCount}명` },
          { label: "관제 범위", value: areaLabel(zone) },
          { label: "근무시간", value: zone.scheduleLabel ?? "미설정" },
        ].map((stat) => (
          <span
            key={stat.label}
            className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl bg-soft px-3 py-2.5"
          >
            <span className="text-[11px] font-bold text-ink-muted">{stat.label}</span>
            <span
              className={`text-sm leading-snug font-extrabold break-words ${stat.value === "미설정" ? "text-ink-muted" : "text-ink"}`}
            >
              {stat.value}
            </span>
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2.5 border-t-[1.5px] border-page pt-3">
        <span
          className={`text-[13px] font-extrabold ${
            zone.escapeCount > 0
              ? "text-escape-ink"
              : zone.workingCount > 0
                ? "text-ok-ink"
                : "text-ink-muted"
          }`}
        >
          {zone.escapeCount > 0
            ? `지금 ${zone.escapeCount}명 구역 밖`
            : zone.workingCount > 0
              ? `근무 중 ${zone.workingCount}명 · 모두 구역 안`
              : "지금 근무 중인 사람이 없어요"}
        </span>
        <span className="flex-none text-[13px] font-extrabold text-accent">상세 보기 ›</span>
      </div>
    </Link>
  );
};

const ZonesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get("filter") as ZoneFilter | null) ?? "all";
  const [keyword, setKeyword] = useState("");
  const { data: zones, isPending, isError, error } = useQuery(mobileZonesQueryOptions);

  const allZones = zones ?? [];
  const normalizedKeyword = keyword.trim();
  const visibleZones = allZones
    .filter((zone) => matchesFilter(zone, filter))
    .filter(
      (zone) =>
        !normalizedKeyword ||
        zone.name.includes(normalizedKeyword) ||
        (zone.address ?? "").includes(normalizedKeyword) ||
        zone.programName.includes(normalizedKeyword),
    );

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-none flex-col gap-5 bg-accent px-5 pt-[22px] pb-6">
        <div>
          <p className="text-[15px] font-extrabold text-white/85">관제 구역</p>
          <h1 className="mt-1.5 text-[26px] font-extrabold text-white">
            수요처 {allZones.length}곳
          </h1>
          <p className="mt-1.5 text-sm font-semibold text-white/85">
            구역을 벗어나면 담당자에게 이탈 알림이 가요
          </p>
        </div>
        <HeaderStats
          stats={[
            { label: "관제 중", value: `${allZones.filter(hasArea).length}곳` },
            {
              label: "지금 이탈",
              value: `${allZones.reduce((sum, zone) => sum + zone.escapeCount, 0)}명`,
            },
            {
              label: "시간 미설정",
              value: `${allZones.filter((zone) => zone.scheduleLabel === null).length}곳`,
            },
          ]}
        />
        <label className="flex h-[52px] items-center gap-2.5 rounded-2xl bg-white px-4">
          <Search size={18} className="flex-none text-ink-muted" aria-hidden="true" />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="수요처명·주소·사업단 검색"
            aria-label="수요처 검색"
            className="min-w-0 flex-1 text-[15px] font-bold text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
      </header>

      <div className="flex flex-none gap-1.5 overflow-x-auto border-b-[1.5px] border-line bg-white px-4 py-2.5">
        {ZONE_FILTERS.map((zoneFilter) => (
          <button
            key={zoneFilter.id}
            type="button"
            aria-pressed={filter === zoneFilter.id}
            onClick={() => setSearchParams({ filter: zoneFilter.id }, { replace: true })}
            className={`flex-none rounded-full px-[15px] py-[9px] text-sm font-extrabold whitespace-nowrap ${
              filter === zoneFilter.id ? "bg-accent text-white" : "bg-soft text-ink-sub"
            }`}
          >
            {zoneFilter.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {isPending && (
          <p className="py-10 text-center text-sm font-bold text-ink-muted">불러오는 중...</p>
        )}
        {isError && (
          <p className="py-10 text-center text-sm font-bold text-sos-ink">
            {error instanceof Error ? error.message : "불러오지 못했어요."}
          </p>
        )}
        {zones && visibleZones.length === 0 && (
          <p className="py-10 text-center text-sm font-bold text-ink-muted">
            해당하는 수요처가 없어요
          </p>
        )}
        {visibleZones.map((zone) => (
          <ZoneCard key={zone.id} zone={zone} />
        ))}
      </div>
    </div>
  );
};

export default ZonesPage;
