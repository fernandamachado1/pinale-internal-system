import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ResponsiveDialogContextValue = { isMobile: boolean };

const ResponsiveDialogContext = React.createContext<ResponsiveDialogContextValue | null>(null);
const ResponsiveDialogPaddingContext = React.createContext<{ padded: boolean }>({ padded: true });

function useResponsiveDialogContext(): ResponsiveDialogContextValue {
  const ctx = React.useContext(ResponsiveDialogContext);
  if (!ctx) throw new Error("ResponsiveDialog components must be used within <ResponsiveDialog />");
  return ctx;
}

function useResponsiveDialogPadding(): { padded: boolean } {
  return React.useContext(ResponsiveDialogPaddingContext);
}

export interface ResponsiveDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveDialog(props: ResponsiveDialogProps) {
  return (
    <ResponsiveDialogContext.Provider value={{ isMobile: useIsMobile() }}>
      <Dialog {...props} />
    </ResponsiveDialogContext.Provider>
  );
}

export function ResponsiveDialogTrigger(props: React.ComponentPropsWithoutRef<typeof DialogTrigger>) {
  return <DialogTrigger {...props} />;
}

export function ResponsiveDialogClose(props: React.ComponentPropsWithoutRef<typeof DialogClose>) {
  return <DialogClose {...props} />;
}

export type ResponsiveDialogContentProps = React.ComponentPropsWithoutRef<typeof DialogContent> & {
  noPadding?: boolean;
};

export function ResponsiveDialogContent(props: ResponsiveDialogContentProps) {
  const { isMobile } = useResponsiveDialogContext();
  if (isMobile) {
    const { children, className, noPadding, ...rest } = props as any;
    const padded = !noPadding && !(className ?? "").split(/\s+/).includes("p-0");
    return (
      <DialogContent
        {...rest}
        className={cn(
          "left-0 top-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden",
          className,
        )}
      >
        <div className={cn("flex h-full min-h-0 flex-col", padded ? "px-4" : undefined)}>
          <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden", padded ? "pb-4" : undefined)}>
            <ResponsiveDialogPaddingContext.Provider value={{ padded }}>{children}</ResponsiveDialogPaddingContext.Provider>
          </div>
        </div>
      </DialogContent>
    );
  }

  const { children, className, ...rest } = props as any;
  return (
    <ResponsiveDialogPaddingContext.Provider value={{ padded: true }}>
      <DialogContent
        {...rest}
        className={cn(
          "max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl md:p-6",
          className,
        )}
      >
        {children}
      </DialogContent>
    </ResponsiveDialogPaddingContext.Provider>
  );
}

export function ResponsiveDialogHeader(props: React.ComponentPropsWithoutRef<typeof DialogHeader>) {
  const { isMobile } = useResponsiveDialogContext();
  if (isMobile) {
    const { children, className, ...rest } = props;
    return (
      <DialogHeader {...(rest as any)} className={cn("mb-2 flex flex-row items-start gap-2 border-b px-4 pb-3 pt-3", className)}>
        <DialogClose asChild>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </DialogClose>
        <div className="min-w-0 flex-1 space-y-1 text-left">{children}</div>
      </DialogHeader>
    );
  }
  return <DialogHeader {...props} className={cn("border-b border-border px-4 pb-4 pt-4 text-left md:px-6 md:pb-5 md:pt-5", props.className)} />;
}

export function ResponsiveDialogFooter(props: React.ComponentPropsWithoutRef<typeof DialogFooter>) {
  const { padded } = useResponsiveDialogPadding();
  return (
    <DialogFooter
      {...(props as any)}
      className={cn(
        "sticky bottom-0 z-30 mt-4 w-full border-t border-border bg-card p-4 shadow-[0_-1px_0_hsl(var(--border))]",
        padded ? "-mx-4" : undefined,
        props.className,
      )}
    />
  );
}

export function ResponsiveDialogTitle(props: React.ComponentPropsWithoutRef<typeof DialogTitle>) {
  return <DialogTitle {...props} />;
}

export function ResponsiveDialogDescription(props: React.ComponentPropsWithoutRef<typeof DialogDescription>) {
  return <DialogDescription {...props} />;
}
