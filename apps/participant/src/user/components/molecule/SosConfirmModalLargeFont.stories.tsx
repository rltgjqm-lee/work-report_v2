import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import SosConfirmModalLargeFont from "./SosConfirmModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/SosConfirmModalLargeFont",
  component: SosConfirmModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  // 카운트다운이 0에 닿으면 onSend가 자동 호출된다 — 스토리에서도 10초 뒤 실제로 호출된다.
  args: { onSend: fn(), onCancel: fn() },
} satisfies Meta<typeof SosConfirmModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
