import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ticket Booking - Đặt vé sự kiện",
  description: "Hệ thống đặt vé sự kiện trực tuyến - Mua vé concert, thể thao, hội nghị nhanh chóng và an toàn",
  // Thêm dòng này vào
  verification: {
    other: {
      "zalo-platform-site-verification": "UiQ068xFBqCB_O9-p_4fPJFS-tFVgYygDJCo",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
