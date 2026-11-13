import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import BottomSheet from "./BottomSheet";

const meta = {
  title: "User/Atoms/BottomSheet",
  component: BottomSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onClose: fn() },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShortContent: Story = {
  args: {
    children: (
      <div className="text-center">
        <div className="text-[17px] font-extrabold text-text-strong">오늘은 근무일이 아니에요</div>
        <button className="w-full h-[52px] rounded-[14px] bg-brand text-white text-[16px] font-extrabold border-none mt-5 cursor-pointer">
          확인
        </button>
      </div>
    ),
  },
};

// 큰글씨 모드처럼 텍스트가 늘어나도 고정폭 카드처럼 잘리지 않고, 패널 높이가
// 내용만큼 자연스럽게 늘어나는지 확인하기 위한 스토리.
export const LongContent: Story = {
  args: {
    children: (
      <div className="text-center">
        <div className="text-[22px] font-extrabold text-text-strong leading-[1.6]">
          업무일지·안전일지·서명을
          <br />
          다 마쳐야 오늘 활동일지가
          <br />
          제출 처리돼요
        </div>
        <div className="text-[17px] text-text-tertiary font-semibold leading-[1.7] mt-3">
          아직 완료되지 않은 항목이 있으니
          <br />
          사업 담당자에게 문의해 주세요
        </div>
        <button className="w-full h-[52px] rounded-[14px] bg-brand text-white text-[16px] font-extrabold border-none mt-5 cursor-pointer">
          확인
        </button>
      </div>
    ),
  },
};
