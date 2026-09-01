import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import NotWorkDayModalLargeFont from "./NotWorkDayModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/NotWorkDayModalLargeFont",
  component: NotWorkDayModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof NotWorkDayModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
