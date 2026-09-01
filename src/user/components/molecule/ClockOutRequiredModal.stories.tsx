import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockOutRequiredModal from "./ClockOutRequiredModal";

const meta = {
  title: "User/Molecule/Modal/ClockOutRequiredModal",
  component: ClockOutRequiredModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { onConfirm: fn() },
} satisfies Meta<typeof ClockOutRequiredModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
