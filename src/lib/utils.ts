import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard shadcn/ui class combiner — kept so shadcn components drop in cleanly. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
