'use client';

import { ToastContainer } from '@/components/ui/Toast';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-dark bg-[url('/images/bg.jpg')] bg-cover bg-fixed bg-center">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <ToastContainer />
    </div>
  );
}
