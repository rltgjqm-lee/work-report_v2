import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import Dropdown from "./Dropdown";

const OPTIONS = [
  { value: "AM", label: "오전" },
  { value: "PM", label: "오후" },
];

const meta = {
  title: "User/Molecule/Dropdown",
  component: Dropdown,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { options: OPTIONS, value: "AM", onChange: fn() },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-[160px]">
        <Dropdown {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLabel: Story = {
  args: { label: "오전/오후", value: "AM" },
};

export const WithoutLabel: Story = {
  args: { value: "PM" },
};
