"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // Track (background)
        "peer inline-flex h-[1.25rem] w-9 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Explicit colors for ON/OFF
        "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // Thumb (the white circle)
          "pointer-events-none block size-4 rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
          // Move thumb when ON
          "data-[state=checked]:translate-x-[calc(100%-3px)] data-[state=unchecked]:translate-x-[1px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
