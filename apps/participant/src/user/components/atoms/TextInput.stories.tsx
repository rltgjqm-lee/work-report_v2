import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import TextInput from "./TextInput";

const meta = {
  title: "User/Atoms/TextInput",
  component: TextInput,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  render: (args) => {
    const [value, setValue] = useState(args.value ?? "");
    return (
      <div className="w-[320px]">
        <TextInput {...args} value={value} onChange={(event) => setValue(event.target.value)} />
      </div>
    );
  },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { id: "name", placeholder: "이름을 입력해주세요" },
};

export const Filled: Story = {
  args: { id: "name", placeholder: "이름을 입력해주세요", value: "홍길동" },
};
