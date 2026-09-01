import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import OutOfAreaModal from "./OutOfAreaModal";

const meta = {
  title: "User/Molecule/Modal/OutOfAreaModal",
  component: OutOfAreaModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof OutOfAreaModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithDistance: Story = {
  args: { distanceM: 120 },
};

export const WithDistanceInKm: Story = {
  args: { distanceM: 1450 },
};

export const WithoutDistance: Story = {
  args: { distanceM: null },
};
