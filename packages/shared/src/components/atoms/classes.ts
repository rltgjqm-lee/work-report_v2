// Canvas.dc.html의 "1c 앱스럽게" 옵션 스타일 값을 그대로 이식한 공용 클래스.
// overflow-y-auto를 페이지 자체에 줘서 본문+BottomBar가 하나의 스크롤 영역이 되게 한다 —
// 화면이 낮으면 끝까지 스크롤해야 다음 버튼(BottomBar)이 보인다. 헤더(AppBar)는
// sticky top-0으로 따로 고정한다.
export const pageClass = "flex flex-col bg-surface-page h-full min-h-0 flex-1 overflow-y-auto";

export const bodyClass = "px-5 pt-4 pb-5 flex-1 flex flex-col gap-3.5";

export const cardClass =
  "bg-white rounded-[20px] p-[22px] shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex flex-col gap-5";

export const labelClass = "text-[16px] font-extrabold text-text-strong mb-2.5 block";
export const labelSmallClass = "block text-[13px] text-text-muted font-semibold mt-1";

export const inputClass =
  "w-full h-14 box-border border-[1.5px] border-border-default rounded-2xl px-4 text-[19px] font-sans text-text-strong font-semibold bg-surface-muted";

export const textareaClass =
  "w-full box-border border-[1.5px] border-border-default rounded-2xl p-4 text-[18px] font-sans text-text-strong font-semibold bg-surface-muted h-24 resize-none leading-relaxed";

// 네이티브 select 화살표는 위치를 못 옮기므로(특히 Safari) appearance-none으로
// 지우고 Dropdown 컴포넌트에서 lucide ChevronDown을 직접 얹어 위치를 제어한다.
export const selectClass =
  "appearance-none w-full box-border h-[54px] border-[1.5px] border-border-default rounded-2xl pl-2.5 pr-9 text-[17px] font-sans text-text-strong font-semibold bg-surface-muted";

export const btnPrimaryClass =
  "w-full h-[58px] bg-brand text-white border-none rounded-2xl text-[18px] font-extrabold font-sans cursor-pointer disabled:bg-border-default disabled:text-text-disabled disabled:cursor-not-allowed";

export const btnOutlineClass =
  "flex-1 h-14 bg-white text-brand border-[1.5px] border-brand rounded-2xl text-[16px] font-extrabold font-sans cursor-pointer";

export const btnTextClass =
  "bg-transparent border-none text-text-muted text-[14px] font-bold underline font-sans cursor-pointer";

export const choiceCardClass = (selected: boolean) =>
  `flex items-center gap-3.5 border-[1.5px] rounded-2xl px-5 py-[18px] text-[18px] font-bold mb-3 cursor-pointer ${
    selected
      ? "border-brand bg-brand-tint text-brand"
      : "border-border-default bg-white text-text-strong"
  }`;

export const choiceRadioClass = (selected: boolean) =>
  `w-6 h-6 rounded-full border-2 flex-none flex items-center justify-center text-[13px] text-white ${
    selected ? "border-brand bg-brand" : "border-border-subtle bg-transparent"
  }`;

export const sigBoxClass =
  "border-[1.5px] border-dashed border-border-dashed rounded-2xl h-[150px] bg-surface-muted relative flex items-center justify-center";

export const sigClearClass =
  "absolute top-3 right-3 bg-danger-tint text-danger text-[14px] font-bold px-3.5 py-2 rounded-[10px] border-none cursor-pointer";
