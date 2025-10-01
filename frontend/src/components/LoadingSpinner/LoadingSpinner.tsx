import React from "react";
import styles from "./LoadingSpinner.module.css";

type Size = "xs" | "sm" | "md" | "lg" | number;

type LoadingSpinnerProps = {
  size?: Size;                 
  ariaLabel?: string;         
  className?: string;          
};

const SIZE_TO_PX: Record<Exclude<Size, number>, number> = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 32
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "md", ariaLabel = "Loading", className }) => {
  const px = typeof size === "number" ? size : SIZE_TO_PX[size] ?? SIZE_TO_PX.md;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`${styles.spinner} ${className ?? ""}`}
      style={{ width: px, height: px }}
    />
  );
};

export default LoadingSpinner;
