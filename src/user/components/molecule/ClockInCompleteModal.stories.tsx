import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockInCompleteModal from "./ClockInCompleteModal";

const meta = {
  title: "User/Molecule/Modal/ClockInCompleteModal",
  component: ClockInCompleteModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { startTime: "오전 09:02", onConfirm: fn() },
} satisfies Meta<typeof ClockInCompleteModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
