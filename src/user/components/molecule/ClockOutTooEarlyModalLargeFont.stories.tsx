import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockOutTooEarlyModalLargeFont from "./ClockOutTooEarlyModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/ClockOutTooEarlyModalLargeFont",
  component: ClockOutTooEarlyModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { shiftEnd: "18:00", onConfirm: fn() },
} satisfies Meta<typeof ClockOutTooEarlyModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
