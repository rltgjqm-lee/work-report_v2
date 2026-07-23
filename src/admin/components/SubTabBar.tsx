import { subTabBarClass, subTabBtnActiveClass, subTabBtnClass } from "../uiClasses";

interface SubTabBarProps<T extends string> {
  tabs: [T, string][];
  active: T;
  onChange: (tab: T) => void;
}

const SubTabBar = <T extends string>({
  tabs,
  active,
  onChange,
}: SubTabBarProps<T>) => (
  <div className={subTabBarClass}>
    {tabs.map(([tabKey, label]) => (
      <button
        key={tabKey}
        onClick={() => onChange(tabKey)}
        className={tabKey === active ? subTabBtnActiveClass : subTabBtnClass}
      >
        {label}
      </button>
    ))}
  </div>
);

export default SubTabBar;
