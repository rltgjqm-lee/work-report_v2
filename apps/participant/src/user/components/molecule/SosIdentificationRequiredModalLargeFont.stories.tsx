import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import SosIdentificationRequiredModalLargeFont from "./SosIdentificationRequiredModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/SosIdentificationRequiredModalLargeFont",
  component: SosIdentificationRequiredModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn(), isBasicInfoRegistered: true },
} satisfies Meta<typeof SosIdentificationRequiredModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BasicInfoNotRegistered: Story = {
  args: { isBasicInfoRegistered: false },
};
