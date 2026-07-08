import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NitiFlow | AI-Powered Constituency Intelligence",
  description: "From complaints to clarity in every language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Tiro+Devanagari+Hindi&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-brand-off-white font-body-md text-on-surface antialiased">
        {children}
      </body>
    </html>
  );
}
