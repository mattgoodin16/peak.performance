import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Peak Performance",
  description: "Nutrition and performance tracking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
