"use client";
import { useState, useRef, useCallback } from "react";

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function SpotlightCard({
  children,
  className = "",
  hoverable = true,
}: SpotlightCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hoverable || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    setSpotlightPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [hoverable]);

  const handleMouseEnter = () => {
    if (hoverable) setIsHovering(true);
  };

  const handleMouseLeave = () => {
    if (hoverable) setIsHovering(false);
  };

  return (
    <div
      ref={cardRef}
      className={`relative rounded-lg border border-white/10 bg-[#0e1525] backdrop-blur-sm overflow-hidden transition-all duration-300 ${
        isHovering && hoverable ? "border-white/20" : ""
      } ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Spotlight effect */}
      {hoverable && isHovering && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${spotlightPos.x}px`,
            top: `${spotlightPos.y}px`,
            width: "300px",
            height: "300px",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(0, 240, 255, 0.15) 0%, transparent 70%)",
            filter: "blur(40px)",
            opacity: 0.6,
          }}
        />
      )}

      {/* Glass gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
