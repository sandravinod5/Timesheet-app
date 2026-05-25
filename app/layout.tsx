import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { ToastProvider } from "@/components/toast-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracker",
  description: "Task and timesheet management PWA for ERPNext users",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tracker"
  },
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#e0e5ec",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <ToastProvider>
          <PwaRegister />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
