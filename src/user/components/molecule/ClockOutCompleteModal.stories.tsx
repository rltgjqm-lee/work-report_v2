import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockOutCompleteModal from "./ClockOutCompleteModal";

const meta = {
  title: "User/Molecule/Modal/ClockOutCompleteModal",
  component: ClockOutCompleteModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { endTime: "오후 06:01", onConfirm: fn() },
} satisfies Meta<typeof ClockOutCompleteModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// 퇴근 직후, 아직 서명 전이면 버튼이 전체 확인·서명으로 이어진다
export const BeforeSignature: Story = { args: { confirmLabel: "서명하러 가기" } };
