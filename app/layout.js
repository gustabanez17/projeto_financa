import "./globals.css";

export const metadata = {
  title: "Finanças — Planejamento do casal",
  description: "Planejamento financeiro de Rebeca e Gustavo"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
