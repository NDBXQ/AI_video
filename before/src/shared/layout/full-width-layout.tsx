import { Navbar } from './navbar';

interface FullWidthLayoutProps {
  children: React.ReactNode;
}

export function FullWidthLayout({ children }: FullWidthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="w-full px-4 py-8">{children}</main>
    </div>
  );
}

