import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockOutTooEarlyModal from "./ClockOutTooEarlyModal";

const meta = {
  title: "User/Molecule/Modal/ClockOutTooEarlyModal",
  component: ClockOutTooEarlyModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { shiftEnd: "18:00", onConfirm: fn() },
} satisfies Meta<typeof ClockOutTooEarlyModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
