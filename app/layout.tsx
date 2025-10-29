// app/layout.tsx
import "./global.css";
import React from "react";

export const metadata = {
  title: "epldata",
  description: "Ethiopian Premier League Data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
