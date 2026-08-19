import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "시놀로지 NAS 사용자 매뉴얼",
  description: "Synology Drive 설치, 설정, PC·모바일·웹 사용을 안내하는 사내 매뉴얼",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
