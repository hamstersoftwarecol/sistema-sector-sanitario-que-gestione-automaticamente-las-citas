import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "MediCita IA · Agenda médica automática con inteligencia artificial",
    template: "%s · MediCita IA",
  },
  description:
    "SaaS para clínicas y consultorios: los pacientes reservan con un asistente de IA, los médicos gestionan su disponibilidad y la agenda se llena sola.",
};

export const viewport: Viewport = {
  themeColor: "#088578",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
