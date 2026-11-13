import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import SosIdentificationRequiredModal from "./SosIdentificationRequiredModal";

const meta = {
  title: "User/Molecule/Modal/SosIdentificationRequiredModal",
  component: SosIdentificationRequiredModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn(), isBasicInfoRegistered: true },
} satisfies Meta<typeof SosIdentificationRequiredModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BasicInfoNotRegistered: Story = {
  args: { isBasicInfoRegistered: false },
};
