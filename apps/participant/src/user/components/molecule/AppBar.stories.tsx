import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import AppBar from "./AppBar";

const meta = {
  title: "User/Molecule/AppBar",
  component: AppBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { title: "업무 등록" },
} satisfies Meta<typeof AppBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const WithBack: Story = {
  args: { onBack: fn() },
};

export const WithHome: Story = {
  args: { onHome: fn() },
};

// participantId를 넘기면 우측에 SOS 버튼이 뜬다 — 본인확인이 끝난 화면 전용.
export const WithSosButton: Story = {
  args: { title: "대시보드", onHome: fn(), participantId: 1 },
};
