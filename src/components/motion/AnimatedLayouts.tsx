import React from "react";
import { cn } from "@/lib/utils";

// Using standard tailwindcss-animate utility classes for subtle iOS-inspired motion.
// The animate-in and duration utilities handle the page load transitions.

export function AnimatedPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both", className)}>
      {children}
    </div>
  );
}

export function AnimatedCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in zoom-in-95 duration-400 ease-out fill-mode-both transition-transform active:scale-[0.98]",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function AnimatedList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-3", className)}>{children}</div>;
}

export function AnimatedListItem({
  children,
  className,
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-3 duration-400 ease-out fill-mode-both", className)}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {children}
    </div>
  );
}
