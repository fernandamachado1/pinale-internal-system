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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

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
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Dialog;

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile }}>
      <Root {...props} />
    </ResponsiveDialogContext.Provider>
  );
}

export function ResponsiveDialogTrigger(props: React.ComponentPropsWithoutRef<typeof DialogTrigger>) {
  const { isMobile } = useResponsiveDialogContext();
  const Trigger = isMobile ? DrawerTrigger : DialogTrigger;
  return <Trigger {...props} />;
}

export function ResponsiveDialogClose(props: React.ComponentPropsWithoutRef<typeof DialogClose>) {
  const { isMobile } = useResponsiveDialogContext();
  const Close = isMobile ? DrawerClose : DialogClose;
  return <Close {...props} />;
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
      <DrawerContent
        {...rest}
        className={cn("mt-0 h-[100dvh] max-h-[100dvh] overflow-hidden rounded-none border-0 [&>div:first-child]:hidden", className)}
      >
        <div className={cn("flex h-full min-h-0 flex-col", padded ? "px-4" : undefined)}>
          <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden", padded ? "pb-4" : undefined)}>
            <ResponsiveDialogPaddingContext.Provider value={{ padded }}>{children}</ResponsiveDialogPaddingContext.Provider>
          </div>
        </div>
      </DrawerContent>
    );
  }

  const { children, className, ...rest } = props as any;
  return (
    <ResponsiveDialogPaddingContext.Provider value={{ padded: true }}>
      <DialogContent {...rest} className={cn("overflow-x-hidden", className)}>
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
      <DrawerHeader {...(rest as any)} className={cn("mb-2 flex flex-row items-start gap-2 border-b pb-3 pt-3", className)}>
        <DrawerClose asChild>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </DrawerClose>
        <div className="min-w-0 flex-1 space-y-1 text-left">{children}</div>
      </DrawerHeader>
    );
  }
  return <DialogHeader {...props} />;
}

export function ResponsiveDialogFooter(props: React.ComponentPropsWithoutRef<typeof DialogFooter>) {
  const { isMobile } = useResponsiveDialogContext();
  const { padded } = useResponsiveDialogPadding();
  if (isMobile)
    return (
      <DrawerFooter
        {...(props as any)}
        className={cn(
          "sticky bottom-0 mt-4 border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          padded ? "-mx-4" : undefined,
          props.className,
        )}
      />
    );
  return <DialogFooter {...props} />;
}

export function ResponsiveDialogTitle(props: React.ComponentPropsWithoutRef<typeof DialogTitle>) {
  const { isMobile } = useResponsiveDialogContext();
  const Title = isMobile ? DrawerTitle : DialogTitle;
  return <Title {...props} />;
}

export function ResponsiveDialogDescription(props: React.ComponentPropsWithoutRef<typeof DialogDescription>) {
  const { isMobile } = useResponsiveDialogContext();
  const Description = isMobile ? DrawerDescription : DialogDescription;
  return <Description {...props} />;
}
