import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "accent" | "danger" | "success";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#990033] disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-[#990033] text-white hover:bg-[#80002b]",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "border-2 border-[#990033] text-[#990033] hover:bg-[#990033]/10",
    ghost: "hover:bg-gray-100 text-gray-700 hover:text-gray-900",
    accent: "bg-[#FFCC00] text-black hover:bg-[#e6b800]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-green-600 text-white hover:bg-green-700",
  };
  const sizes = {
    default: "h-10 py-2 px-4 text-sm",
    sm: "h-8 px-3 text-xs",
    lg: "h-12 px-8 text-base",
    icon: "h-10 w-10",
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold leading-none tracking-tight text-[#990033]", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "warning" | "success" | "danger" | "outline";
}) {
  const variants = {
    default: "bg-[#990033]/10 text-[#990033]",
    warning: "bg-[#FFCC00]/20 text-[#997a00] border border-[#FFCC00]/50",
    success: "bg-green-100 text-green-800",
    danger: "bg-red-100 text-red-800",
    outline: "border border-gray-200 text-gray-800",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#990033] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  );
}
