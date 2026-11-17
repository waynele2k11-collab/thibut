import { Card } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendUp,
}: MetricCardProps) {
  return (
    <Card className="p-6">
      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
        {title}
      </h3>
      <div className="flex items-end gap-3">
        <span className="font-headline-md text-headline-md text-primary">
          {value}
        </span>
        {trend && (
          <span
            className={`font-label-caps text-label-caps mb-1 ${
              trendUp ? "text-primary" : "text-secondary"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="font-body-md text-sm text-on-surface-variant mt-2">
          {subtitle}
        </p>
      )}
    </Card>
  );
}
