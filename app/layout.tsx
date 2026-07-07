import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서울시 도시재생 체감지도",
  description: "서울시 도시재생활성화지역을 지도에서 선택하고 성과와 의견을 함께 확인합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
