import type { Meta, StoryObj } from "@storybook/react-vite";

import LocationTrackingStatusBanner from "./LocationTrackingStatusBanner";

const meta = {
  title: "User/Molecule/LocationTrackingStatusBanner",
  component: LocationTrackingStatusBanner,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 300 } } },
  // 원래 Main.tsx에서처럼 position: relative인 화면 컨테이너 안에서 화면 아래에 붙어야
  // 실제 배치와 같게 보인다.
  decorators: [
    (Story) => (
      <div className="relative w-full h-72 bg-app-shell-bg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LocationTrackingStatusBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Escaped: Story = {
  args: { escapedDemandSiteName: "행복복지관", reportFailing: false },
};

export const ReportFailing: Story = {
  args: { escapedDemandSiteName: null, reportFailing: true },
};

export const Idle: Story = {
  args: { escapedDemandSiteName: null, reportFailing: false },
};
