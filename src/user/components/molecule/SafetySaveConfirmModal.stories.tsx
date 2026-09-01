import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import SafetySaveConfirmModal from "./SafetySaveConfirmModal";

const meta = {
  title: "User/Molecule/Modal/SafetySaveConfirmModal",
  component: SafetySaveConfirmModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { onConfirm: fn() },
} satisfies Meta<typeof SafetySaveConfirmModal>;

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
