import { studioBrushFontVariables } from "@/fonts/index";

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={studioBrushFontVariables}>{children}</div>;
}
