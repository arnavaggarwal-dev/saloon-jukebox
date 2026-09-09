// From React Bits (reactbits.dev) — "Star Border". Types removed.
export default function StarBorder({ as: Tag = 'button', className = '', color = '#f6dda6', speed = '5s', children, ...rest }) {
  return (
    <Tag className={`relative inline-block overflow-hidden rounded-full py-[2px] ${className}`} {...rest}>
      <div
        className="absolute right-[-250%] bottom-0 z-0 h-1/2 w-[300%] rounded-full opacity-60"
        style={{ background: `radial-gradient(circle, ${color}, transparent 12%)`, animation: `star-move-b ${speed} linear infinite alternate` }}
      />
      <div
        className="absolute top-0 left-[-250%] z-0 h-1/2 w-[300%] rounded-full opacity-60"
        style={{ background: `radial-gradient(circle, ${color}, transparent 12%)`, animation: `star-move-t ${speed} linear infinite alternate` }}
      />
      <div className="relative z-10 rounded-full border border-brass-600/60 bg-wood-800 px-6 py-3 text-parchment-100">
        {children}
      </div>
    </Tag>
  );
}
