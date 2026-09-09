// From React Bits (reactbits.dev) — "Shiny Text", reduced to a CSS sweep so it
// needs no animation library.
export default function ShinyText({ text, className = '', speed = 4, color = '#e0a94f', shine = '#fff3d6' }) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(110deg, ${color} 40%, ${shine} 50%, ${color} 60%)`,
        backgroundSize: '250% 100%',
        animation: `shine ${speed}s linear infinite`,
      }}
    >
      {text}
    </span>
  );
}
