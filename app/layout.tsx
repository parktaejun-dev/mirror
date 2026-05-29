import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "대보기",
  description: "실물 옷을 내 사진 위에 빠르게 대보고 비교하는 모바일 착장 캔버스",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "대보기",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f7f3"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
