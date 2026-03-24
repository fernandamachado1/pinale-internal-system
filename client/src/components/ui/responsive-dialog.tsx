import * as React from "react";
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
      <DrawerContent {...rest} className={cn("max-h-[85vh] overflow-hidden", className)}>
        <div className={cn("flex min-h-0 flex-col", padded ? "px-4" : undefined)}>
          <div className={cn("flex-1 min-h-0 overflow-y-auto overflow-x-hidden", padded ? "pb-4 pt-2" : undefined)}>
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
  if (isMobile) return <DrawerHeader {...(props as any)} className={cn("p-0", props.className)} />;
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
