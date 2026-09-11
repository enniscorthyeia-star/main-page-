'use client';

export function FlowButton({ text = "Modern Button" }: { text?: string }) {
  return (
    <button className="group relative flex items-center justify-center overflow-hidden rounded-[100px] border-[1.5px] border-[#333333]/40 bg-transparent px-9 py-3.5 text-sm font-semibold text-[#111111] cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-transparent hover:text-white hover:rounded-[12px] active:scale-[0.96]">
      {/* Text */}
      <span className="relative z-[2] transition-colors duration-400 ease-in-out">
        {text}
      </span>

      {/* Circle */}
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#111111] rounded-[50%] opacity-0 group-hover:w-[350px] group-hover:h-[350px] group-hover:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)]"></span>
    </button>
  );
}
