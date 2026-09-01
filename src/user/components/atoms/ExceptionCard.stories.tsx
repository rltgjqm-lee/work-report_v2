import type { Meta, StoryObj } from "@storybook/react-vite";

import ExceptionCard from "./ExceptionCard";

const meta = {
  title: "User/Atoms/ExceptionCard",
  component: ExceptionCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ExceptionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Warn: Story = {
  args: {
    variant: "warn",
    title: "참여 중인 사업이 없어요",
    body: "행복복지관\n노인일자리 지원사업",
    note: "사업 담당자에게 문의해 주세요",
  },
};

export const Caution: Story = {
  args: {
    variant: "caution",
    title: "아직 사업 시작 전이에요",
    note: "2026.09.15부터 이용할 수 있어요",
  },
};
