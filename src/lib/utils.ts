import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMergeStitch = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-lg",
            "display-lg-mobile",
            "headline-md",
            "headline-sm",
            "body-lg",
            "body-md",
            "label-caps",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMergeStitch(clsx(inputs));
}
