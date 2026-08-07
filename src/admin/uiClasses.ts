export const inputClass =
  "w-full border border-admin-border px-3 py-2.5 text-[13px] rounded-[2px] font-sans box-border";
// inputClass는 w-full이 박혀있어서 flex 한 줄에 여러 인풋을 나란히 두면 자기들끼리
// 밀어내며 줄바꿈된다 (Tailwind는 클래스 문자열 순서가 아니라 자체 생성 순서로
// 우선순위를 매겨서 뒤에 w-[Npx]를 붙여도 못 이김) — 그래서 폭 고정 인풋은 이걸 쓴다.
export const compactInputClass =
  "flex-none w-[64px] border border-admin-border px-2 py-2.5 text-[13px] rounded-[2px] font-sans box-border";
// 네이티브 select 화살표는 브라우저가 그리는 영역이라 padding-right를 줘도 위치가
// 안 움직인다(특히 Safari) — appearance-none으로 네이티브 화살표를 없애고
// FilterSelect에서 lucide ChevronDown 아이콘을 직접 얹어서 위치를 제어한다.
export const selectClass =
  "appearance-none border border-admin-border pl-2.5 pr-8 py-2.5 text-[13px] rounded-[2px] font-sans bg-white";
export const searchInputClass =
  "border border-admin-border px-3 py-2.5 text-[13px] rounded-[2px] min-w-[220px] font-sans box-border";
export const btnPrimaryClass =
  "border-none px-4 py-2.5 text-[13px] font-semibold rounded-[2px] cursor-pointer bg-admin-brand text-white hover:brightness-110 whitespace-nowrap";
export const btnGhostClass =
  "border border-admin-border px-4 py-2.5 text-[13px] font-semibold rounded-[2px] cursor-pointer bg-white text-admin-text-secondary hover:bg-admin-surface-hover whitespace-nowrap";
export const rowActionBtnClass =
  "bg-transparent border-none text-admin-action text-xs font-semibold cursor-pointer px-1.5 py-1 hover:underline";
// 관리자 페이지.dc.html의 .zone-panel-actions a — 색을 따로 지정 안 하고 기본 링크색을
// 그대로 쓰는 패널 헤더용 텍스트 액션(예: "닫기"). rowActionBtnClass(황토색, 행 액션용)와
// 다른 용도라 따로 둔다.
export const panelLinkActionClass =
  "bg-transparent border-none text-admin-brand text-[12.5px] font-bold cursor-pointer hover:text-admin-brand-dark";
// 관리자 페이지.dc.html의 .zone-card-footer/.zone-card-btn — 카드 하단에 구분선을 두고
// 알약형 버튼을 나열하는 영역(거점 관리 카드의 삭제/상태 전환 등에서 쓴다).
export const zoneCardFooterClass = "flex items-center gap-2 mt-3.5 pt-3 border-t border-admin-border-faint";
export const zoneCardBtnClass =
  "text-[12px] font-bold px-[11px] py-1.5 rounded-md bg-surface-page text-admin-text-tertiary cursor-pointer border-none whitespace-nowrap hover:bg-admin-surface-muted-hover";
export const zoneCardBtnDangerClass =
  "text-[12px] font-bold px-[11px] py-1.5 rounded-md bg-admin-danger-tint text-admin-danger cursor-pointer border-none whitespace-nowrap hover:bg-admin-danger-tint-hover";
// 밑줄 강조형 탭(관리자 페이지.dc.html 디자인) — pill형 탭이 필요하면 별도로 쓸 것.
// border-none은 border-style:none이라 border-b-2(너비)를 줘도 안 그려진다 — border-0(너비 0)으로
// 좌/우/위만 리셋하고 아래쪽만 border-b-2로 두께를 올려야 밑줄이 실제로 보인다.
export const tabBarClass = "flex gap-1 mb-4 border-b border-admin-border-subtle";
export const tabBtnClass =
  "border-0 bg-transparent px-[18px] py-[11px] text-sm font-semibold cursor-pointer border-b-2 border-b-transparent text-admin-text-subtle hover:text-text-strong";
export const tabBtnActiveClass =
  "border-0 bg-transparent px-[18px] py-[11px] text-sm font-semibold cursor-pointer border-b-2 border-b-admin-brand text-admin-brand";
// 탭 안의 서브탭(교육 정의/이수 현황/필수교육 현황)용 알약형 버튼 — 바깥 밑줄 탭과
// 시각적으로 구분되게 관리자 페이지.dc.html의 .sub-tabs/.sub-tab-btn을 그대로 따름.
export const subTabBarClass = "flex gap-2 mb-4";
export const subTabBtnClass =
  "border border-admin-border-subtle bg-white px-4 py-2 text-[13px] font-semibold rounded-full cursor-pointer text-admin-text-subtle hover:border-admin-border-hover hover:text-text-strong";
export const subTabBtnActiveClass =
  "border border-admin-brand bg-admin-brand px-4 py-2 text-[13px] font-semibold rounded-full cursor-pointer text-white";
// 양식 출력 카드(관리자 페이지.dc.html의 .export-grid/.export-card) — 사업단 상세 >
// 양식 출력 탭에서 서식별로 카드 하나씩 보여줄 때 쓴다.
export const exportGridClass = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4";
export const exportCardClass = "bg-white border border-admin-border-subtle rounded-lg p-[22px]";
export const exportIconClass = "text-[26px] mb-2.5";
export const exportNameClass = "text-[15px] font-bold text-text-strong mb-1.5";
export const exportDescClass =
  "text-[12.5px] text-admin-text-faint leading-relaxed mb-[18px] min-h-[36px]";
export const monthSelectClass =
  "h-[38px] border border-admin-border rounded-md px-2.5 text-[13px] font-sans text-text-strong bg-white box-border";
// btnPrimaryClass는 rounded-[2px]가 박혀있어서 rounded-md를 뒤에 붙여도 못 이긴다
// (Tailwind 우선순위는 클래스 문자열 순서가 아니라 자체 생성 순서라서) — 그래서 export
// 카드의 다운로드 버튼처럼 더 둥근 모서리가 필요하면 rounded-[2px] 자체가 없는 이 클래스를 쓴다.
export const exportBtnClass =
  "border-none w-full text-center px-4 py-2.5 text-[13px] font-semibold rounded-md cursor-pointer bg-admin-brand text-white hover:brightness-110 whitespace-nowrap";
