import type { Meta, StoryObj } from "@storybook/react-vite";

import PageHeaderCard from "./PageHeaderCard";

const meta = {
  title: "User/Molecule/PageHeaderCard",
  component: PageHeaderCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof PageHeaderCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: "/icons/icon-task.png",
    title: "업무 등록",
    subtitle: "오늘 한 일과 활동 장소를 기록해주세요",
  },
};
