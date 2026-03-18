import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  iconClassName?: string;
}

export function StatCard({ title, value, icon, description, iconClassName }: StatCardProps) {
  return (
    <Card className="rounded-2xl border-0 bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            iconClassName ?? "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {description ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
