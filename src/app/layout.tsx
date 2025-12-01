import "./globals.css";
import { ReactQueryProvider } from "@/components/layout/react-query-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "CENABAST • Control",
  description: "Dashboard de gestión CENABAST",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">


      <body className="min-h-screen bg-background text-foreground antialiased">

        <ReactQueryProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
