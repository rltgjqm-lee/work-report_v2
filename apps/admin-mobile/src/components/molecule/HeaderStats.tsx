import { Fragment } from "react";

type HeaderStat = {
  label: string;
  value: string;
};

type HeaderStatsProps = {
  stats: HeaderStat[];
};

// 남색 헤더 안의 숫자 세 칸
const HeaderStats = ({ stats }: HeaderStatsProps) => (
  <div className="flex rounded-[18px] bg-white/15 px-1 py-3.5">
    {stats.map((stat, index) => (
      <Fragment key={stat.label}>
        {index > 0 && <div className="my-0.5 w-px bg-white/25" aria-hidden="true" />}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-xs font-bold text-white/80">{stat.label}</span>
          <span className="truncate px-1 text-[19px] font-extrabold text-white">{stat.value}</span>
        </div>
      </Fragment>
    ))}
  </div>
);

export default HeaderStats;
