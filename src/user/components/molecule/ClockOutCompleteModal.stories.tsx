import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockOutCompleteModal from "./ClockOutCompleteModal";

const meta = {
  title: "User/Molecule/Modal/ClockOutCompleteModal",
  component: ClockOutCompleteModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { endTime: "오후 06:01", onConfirm: fn() },
} satisfies Meta<typeof ClockOutCompleteModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
