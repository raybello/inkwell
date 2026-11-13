import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-ink-950 shadow-[0_1px_0_rgba(255,255,255,0.15)_inset] hover:bg-accent-soft active:translate-y-px",
        secondary:
          "bg-ink-800 text-ink-100 border border-border-strong hover:bg-ink-750 hover:border-ink-600",
        ghost: "text-muted-strong hover:bg-ink-800 hover:text-foreground",
        outline: "border border-border-strong bg-transparent hover:bg-ink-850 hover:text-foreground",
        danger: "bg-red-900/80 text-red-50 hover:bg-red-800 border border-red-800",
        paper: "bg-paper text-ink-900 hover:bg-white border border-black/10 shadow-sm",
        link: "text-accent hover:text-accent-soft underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-3.5",
        lg: "h-11 px-5 text-[15px]",
        icon: "h-9 w-9",
        "icon-sm": "h-7 w-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
