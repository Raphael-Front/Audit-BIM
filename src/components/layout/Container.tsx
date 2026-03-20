function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full min-w-0 py-8 px-8 md:px-10 overflow-x-hidden">
      {children}
    </div>
  );
}

export { Container };
export default Container;
