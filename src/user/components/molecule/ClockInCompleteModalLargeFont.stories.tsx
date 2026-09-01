import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockInCompleteModalLargeFont from "./ClockInCompleteModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/ClockInCompleteModalLargeFont",
  component: ClockInCompleteModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { startTime: "오전 09:02", onConfirm: fn() },
} satisfies Meta<typeof ClockInCompleteModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
