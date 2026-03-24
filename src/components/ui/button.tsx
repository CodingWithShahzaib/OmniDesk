import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-gradient-to-b from-zinc-800 to-black text-zinc-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.45)] ring-1 ring-black/35 hover:from-zinc-700 hover:to-zinc-900 hover:text-white active:scale-[0.98] dark:from-zinc-700 dark:to-zinc-950 dark:ring-white/10",
        destructive:
          "rounded-full bg-destructive text-destructive-foreground shadow-sm ring-1 ring-destructive/25 hover:bg-destructive/90",
        outline:
          "rounded-full border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-md shadow-sm hover:bg-white/85 dark:hover:bg-white/12 text-foreground",
        secondary:
          "rounded-full border border-white/50 dark:border-white/10 bg-muted/70 dark:bg-muted/40 backdrop-blur-sm text-foreground shadow-sm hover:bg-muted hover:border-white/60 dark:hover:bg-muted/55",
        ghost:
          "rounded-lg border border-transparent hover:bg-muted/80 dark:hover:bg-white/10 text-foreground",
        glass:
          "rounded-full border border-white/40 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-md hover:bg-white/50 dark:hover:bg-white/12 text-foreground shadow-sm",
        link: "rounded-md border-0 bg-transparent p-0 h-auto text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-9 w-9",
        iconSm: "h-8 w-8",
        iconXs: "h-7 w-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
