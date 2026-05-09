import type { ReactNode } from "react";

type MobileFrameProps = {
  children: ReactNode;
  className?: string;
};

export function MobileFrame({ children, className }: MobileFrameProps) {
  return (
    <main className="min-h-screen bg-gray-200 p-3 sm:p-6">
      <div className="mx-auto flex min-h-screen items-center justify-center">
        <section
          className={`relative flex h-[850px] w-full max-w-[400px] flex-col overflow-hidden bg-gray-50 shadow-2xl sm:rounded-[2.5rem] sm:border-8 sm:border-gray-800 ${className ?? ""}`}
        >
          {children}
        </section>
      </div>
    </main>
  );
}
