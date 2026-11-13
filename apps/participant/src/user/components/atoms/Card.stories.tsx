import type { Meta, StoryObj } from "@storybook/react-vite";

import Card from "./Card";

const meta = {
  title: "User/Atoms/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <div className="text-[16px] font-extrabold text-text-strong">오늘의 근무 정보</div>
        <div className="text-[14px] text-text-tertiary font-semibold">
          09:00 ~ 18:00 · 행복복지관
        </div>
      </>
    ),
  },
};
