interface PageHeaderCardProps {
  icon: string;
  title: string;
  subtitle: string;
}

const PageHeaderCard = ({ icon, title, subtitle }: PageHeaderCardProps) => (
  <div className="bg-white rounded-[20px] p-[18px] shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex items-center gap-3.5">
    <img src={icon} alt="" className="w-11 h-11 flex-none" />
    <div>
      <div className="text-[16px] font-extrabold text-text-strong">{title}</div>
      <div className="text-[13px] text-text-subtitle font-semibold mt-0.5">{subtitle}</div>
    </div>
  </div>
);

export default PageHeaderCard;
