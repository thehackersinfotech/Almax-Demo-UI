import React from "react";

interface AIAvatarIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AIAvatarIcon: React.FC<AIAvatarIconProps> = ({ size = 36, style, className }) => {
  const borderRadius = Math.round(size * 0.28);
  const iconSize = Math.round(size * 0.58);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: borderRadius,
        background: "linear-gradient(135deg, #090d16 0%, #1e1b4b 55%, #312e81 100%)",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Subtle top reflection */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "45%",
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%)",
          borderRadius: `${borderRadius}px ${borderRadius}px 0 0`,
          pointerEvents: "none",
        }}
      />
      {/* Precision Modern Enterprise AI Vector Star */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "relative", zIndex: 1 }}
      >
        <defs>
          <linearGradient id={`aiSparkGrad_${size}`} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="0.45" stopColor="#818cf8" />
            <stop offset="1" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        <path
          d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
          fill={`url(#aiSparkGrad_${size})`}
        />
        <path
          d="M19 2C19 3.84095 17.5076 5.33333 15.6667 5.33333C17.5076 5.33333 19 6.82572 19 8.66667C19 6.82572 20.4924 5.33333 22.3333 5.33333C20.4924 5.33333 19 3.84095 19 2Z"
          fill="#ffffff"
          opacity="0.95"
        />
      </svg>
    </div>
  );
};
