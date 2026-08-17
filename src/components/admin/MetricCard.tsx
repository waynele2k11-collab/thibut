interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
}

export function MetricCard({ title, value, subtitle, trend, trendUp }: MetricCardProps) {
  return (
    <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6 shadow-sm">
      <h3 className="font-label-caps text-xs text-[#A09D96] uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="flex items-end gap-3">
        <span className="font-display-md text-3xl text-[#111111]">{value}</span>
        {trend && (
          <span className={`text-sm mb-1 ${trendUp ? "text-green-700" : "text-[#B3261E]"}`}>
            {trend}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-[#A09D96] mt-2">{subtitle}</p>
      )}
    </div>
  );
}
