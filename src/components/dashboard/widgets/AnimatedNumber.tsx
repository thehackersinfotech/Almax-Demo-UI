import { useCountUp } from "@/hooks/useCountUp";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  enabled?: boolean;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function AnimatedNumber({
  value,
  format = (n) => String(n),
  duration,
  enabled = true,
  decimals = 0,
  className,
  style,
}: AnimatedNumberProps) {
  const current = useCountUp(value, { duration, enabled, decimals });
  return <span className={className} style={style}>{format(current)}</span>;
}
