import Card from "../atoms/Card";

type InfoRow = {
  label: string;
  value: string;
};

const InfoRows = ({ rows }: { rows: InfoRow[] }) => (
  <Card className="flex flex-col px-[18px] py-1">
    {rows.map((row) => (
      <div
        key={row.label}
        className="flex items-start justify-between gap-4 border-b-[1.5px] border-soft py-3.5 last:border-b-0"
      >
        <span className="flex-none text-sm font-bold text-ink-muted">{row.label}</span>
        <span className="min-w-0 text-right text-[15px] font-extrabold break-words text-ink">
          {row.value}
        </span>
      </div>
    ))}
  </Card>
);

export default InfoRows;
