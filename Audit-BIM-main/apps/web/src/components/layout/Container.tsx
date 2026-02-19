export function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 pb-6 md:px-6 md:pt-6">
      {children}
    </div>
  );
}
