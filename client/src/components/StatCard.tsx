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
    <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-none transition-colors hover:border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</span>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            iconClassName ?? "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
        {description ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
