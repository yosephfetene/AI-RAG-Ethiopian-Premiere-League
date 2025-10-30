import "./global.css";
import React from "react";

export const metadata = {
  title: "Ethiopian Premier League Chat",
  description: "Ask anything about the Ethiopian Premier League",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
