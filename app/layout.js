import "./globals.css";

export const metadata = {
  title: "AI Course Creator",
  description: "Generate complete courses or ebooks from a single idea",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-gray-900 antialiased">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="frosted rounded-2xl p-6">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
