import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import IncompleteDayModalLargeFont from "./IncompleteDayModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/IncompleteDayModalLargeFont",
  component: IncompleteDayModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof IncompleteDayModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
