import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import SafetySaveConfirmModalLargeFont from "./SafetySaveConfirmModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/SafetySaveConfirmModalLargeFont",
  component: SafetySaveConfirmModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof SafetySaveConfirmModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoAccident: Story = {
  args: { hasAccident: false, accidentDetail: "", accidentAction: "" },
};

export const WithAccident: Story = {
  args: {
    hasAccident: true,
    accidentDetail: "계단에서 미끄러짐",
    accidentAction: "귀가",
  },
};
