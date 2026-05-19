import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#e0e5ec"
};

export default function LoginLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div data-theme="light">{children}</div>;
}
