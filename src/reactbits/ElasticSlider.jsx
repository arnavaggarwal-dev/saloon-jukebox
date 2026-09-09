import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
const MAX_OVERFLOW = 50;
/* Local changes: an onChange callback (the original kept its value entirely
   to itself, so it couldn't drive anything) and ARIA slider semantics with
   keyboard support (it was pointer-only, leaving volume unreachable). */
const ElasticSlider = ({
  onChange,
  ariaLabel = 'Slider',
  defaultValue = 50,
  startingValue = 0,
  maxValue = 100,
  className = "",
  isStepped = false,
  stepSize = 1,
  leftIcon = <>-</>,
  rightIcon = <>+</>
}) => {
  return <div className={`flex flex-col items-center justify-center gap-4 w-48 ${className}`}>
      <Slider
    onChange={onChange}
    ariaLabel={ariaLabel}
    defaultValue={defaultValue}
    startingValue={startingValue}
    maxValue={maxValue}
    isStepped={isStepped}
    stepSize={stepSize}
    leftIcon={leftIcon}
    rightIcon={rightIcon}
  />
    </div>;
};
const Slider = ({
  onChange,
  ariaLabel,
  defaultValue,
  startingValue,
  maxValue,
  isStepped,
  stepSize,
  leftIcon,
  rightIcon
}) => {
  const [value, setValue] = useState(defaultValue);
  const sliderRef = useRef(null);
  const [region, setRegion] = useState("middle");
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);
  useMotionValueEvent(clientX, "change", (latest) => {
    if (sliderRef.current) {
      const { left, right } = sliderRef.current.getBoundingClientRect();
      let newValue;
      if (latest < left) {
        setRegion("left");
        newValue = left - latest;
      } else if (latest > right) {
        setRegion("right");
        newValue = latest - right;
      } else {
        setRegion("middle");
        newValue = 0;
      }
      overflow.jump(decay(newValue, MAX_OVERFLOW));
    }
  });
  const handlePointerMove = (e) => {
    if (e.buttons > 0 && sliderRef.current) {
      const { left, width } = sliderRef.current.getBoundingClientRect();
      let newValue = startingValue + (e.clientX - left) / width * (maxValue - startingValue);
      if (isStepped) {
        newValue = Math.round(newValue / stepSize) * stepSize;
      }
      newValue = Math.min(Math.max(newValue, startingValue), maxValue);
      setValue(newValue);
      onChange?.(newValue);
      clientX.jump(e.clientX);
    }
  };
  const handlePointerDown = (e) => {
    handlePointerMove(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerUp = () => {
    animate(overflow, 0, { type: "spring", bounce: 0.5 });
  };
  const getRangePercentage = () => {
    const totalRange = maxValue - startingValue;
    if (totalRange === 0) return 0;
    return (value - startingValue) / totalRange * 100;
  };
  return <>
      <motion.div
    onHoverStart={() => animate(scale, 1.2)}
    onHoverEnd={() => animate(scale, 1)}
    onTouchStart={() => animate(scale, 1.2)}
    onTouchEnd={() => animate(scale, 1)}
    style={{
      scale,
      opacity: useTransform(scale, [1, 1.2], [0.7, 1])
    }}
    className="flex w-full touch-none select-none items-center justify-center gap-4"
  >
        <motion.div
    animate={{
      scale: region === "left" ? [1, 1.4, 1] : 1,
      transition: { duration: 0.25 }
    }}
    style={{
      x: useTransform(() => region === "left" ? -overflow.get() / scale.get() : 0)
    }}
  >
          {leftIcon}
        </motion.div>

        <div
    ref={sliderRef}
    role="slider"
    tabIndex={0}
    aria-label={ariaLabel}
    aria-valuemin={startingValue}
    aria-valuemax={maxValue}
    aria-valuenow={Math.round(value)}
    onKeyDown={(e) => {
      const big = e.key === "PageUp" || e.key === "PageDown";
      const step = (maxValue - startingValue) / (big ? 5 : 20);
      const d = { ArrowRight: step, ArrowUp: step, PageUp: step, ArrowLeft: -step, ArrowDown: -step, PageDown: -step }[e.key];
      if (d === undefined && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const raw = e.key === "Home" ? startingValue : e.key === "End" ? maxValue : value + d;
      const next = Math.min(Math.max(raw, startingValue), maxValue);
      setValue(next);
      onChange?.(next);
    }}
    className="relative flex w-full max-w-xs flex-grow cursor-grab touch-none select-none items-center py-4"
    onPointerMove={handlePointerMove}
    onPointerDown={handlePointerDown}
    onPointerUp={handlePointerUp}
    onPointerCancel={handlePointerUp}
    onLostPointerCapture={handlePointerUp}
  >
          <motion.div
    style={{
      scaleX: useTransform(() => {
        if (sliderRef.current) {
          const { width } = sliderRef.current.getBoundingClientRect();
          return 1 + overflow.get() / width;
        }
        return 1;
      }),
      scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]),
      transformOrigin: useTransform(() => {
        if (sliderRef.current) {
          const { left, width } = sliderRef.current.getBoundingClientRect();
          return clientX.get() < left + width / 2 ? "right" : "left";
        }
        return "center";
      }),
      height: useTransform(scale, [1, 1.2], [6, 12]),
      marginTop: useTransform(scale, [1, 1.2], [0, -3]),
      marginBottom: useTransform(scale, [1, 1.2], [0, -3])
    }}
    className="flex flex-grow"
  >
            <div className="relative h-full flex-grow overflow-hidden rounded-full bg-gray-400">
              <div className="absolute h-full bg-gray-500 rounded-full" style={{ width: `${getRangePercentage()}%` }} />
            </div>
          </motion.div>
        </div>

        <motion.div
    animate={{
      scale: region === "right" ? [1, 1.4, 1] : 1,
      transition: { duration: 0.25 }
    }}
    style={{
      x: useTransform(() => region === "right" ? overflow.get() / scale.get() : 0)
    }}
  >
          {rightIcon}
        </motion.div>
      </motion.div>
      <p className="sr-only">
        {Math.round(value)}
      </p>
    </>;
};
function decay(value, max) {
  if (max === 0) {
    return 0;
  }
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
}
var ElasticSlider_default = ElasticSlider;
export {
  ElasticSlider_default as default
};
