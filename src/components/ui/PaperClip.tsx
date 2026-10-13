// Silver paper clip holding a sheet; place it absolutely over the top edge.
export function PaperClip({ className = "absolute -top-5 right-10 h-16 w-6 rotate-6" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 64" className={className} fill="none" stroke="#8d8d8d" strokeWidth="2.6" strokeLinecap="round">
      <path d="M8 22V8a4 4 0 0 1 8 0v40a6 6 0 0 1-12 0V14" />
    </svg>
  );
}
