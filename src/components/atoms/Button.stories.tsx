import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import Button from "./Button";

const meta = {
  title: "Shared/Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { onClick: fn(), children: "확인" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "취소" },
};

export const Text: Story = {
  args: { variant: "text", children: "더보기" },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true },
};
