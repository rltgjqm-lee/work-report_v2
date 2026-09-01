import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import IncompleteDayModal from "./IncompleteDayModal";

const meta = {
  title: "User/Molecule/Modal/IncompleteDayModal",
  component: IncompleteDayModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { date: "2026-08-31", onConfirm: fn() },
} satisfies Meta<typeof IncompleteDayModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
