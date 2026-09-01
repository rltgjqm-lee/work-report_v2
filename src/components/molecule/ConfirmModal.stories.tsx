import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ConfirmModal from "./ConfirmModal";

const meta = {
  title: "Shared/Molecule/ConfirmModal",
  component: ConfirmModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { isOpen: true, onConfirm: fn(), onClose: fn() },
} satisfies Meta<typeof ConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleMessage: Story = {
  args: { messages: ["저장 중 오류가 발생했습니다."] },
};

export const MultipleMessages: Story = {
  args: {
    messages: ["이름: 홍길동", "소속 기관: 행복복지관", "사업명: 노인일자리 지원사업"],
  },
};
