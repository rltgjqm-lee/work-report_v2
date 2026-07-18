export type TabKey = "home" | "list";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "home", label: "홈", icon: "⌂" },
  { key: "list", label: "목록", icon: "≡" },
];

interface TabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TabBar = ({ active, onChange }: TabBarProps) => (
  <div className="flex-none flex bg-white border-t border-[#eef0f3]">
    {TABS.map((tab) => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        className={`flex-1 flex flex-col items-center gap-[3px] pt-2.5 pb-2 text-[12px] font-bold bg-transparent border-none cursor-pointer ${
          active === tab.key ? "text-[#3182f6]" : "text-[#9ca3af]"
        }`}
      >
        <span className="text-[19px]">{tab.icon}</span>
        {tab.label}
      </button>
    ))}
  </div>
);

export default TabBar;
