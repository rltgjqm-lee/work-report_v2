import { tabBarClass, tabBtnActiveClass, tabBtnClass } from "../../uiClasses";

interface TabBarProps<T extends string> {
  tabs: [T, string][];
  active: T;
  onChange: (tab: T) => void;
}

const TabBar = <T extends string>({ tabs, active, onChange }: TabBarProps<T>) => (
  <div className={tabBarClass}>
    {tabs.map(([tabKey, label]) => (
      <button
        key={tabKey}
        onClick={() => onChange(tabKey)}
        className={tabKey === active ? tabBtnActiveClass : tabBtnClass}
      >
        {label}
      </button>
    ))}
  </div>
);

export default TabBar;
