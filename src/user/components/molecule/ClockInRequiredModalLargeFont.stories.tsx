import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockInRequiredModalLargeFont from "./ClockInRequiredModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/ClockInRequiredModalLargeFont",
  component: ClockInRequiredModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof ClockInRequiredModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
