import React, { ComponentPropsWithoutRef, ElementType, forwardRef } from "react";

type MotionExtras = {
  initial?: unknown;
  animate?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
};

type MotionComponent<T extends ElementType> = React.ForwardRefExoticComponent<
  ComponentPropsWithoutRef<T> & MotionExtras & React.RefAttributes<Element>
>;

const cache = new Map<string, MotionComponent<ElementType>>();

const getMotionComponent = (tag: string) => {
  const existing = cache.get(tag);
  if (existing) return existing;

  const Comp = forwardRef<Element, MotionExtras & Record<string, unknown>>(
    ({ initial, animate, whileHover, whileTap, ...props }, ref) => React.createElement(tag, { ...props, ref })
  ) as MotionComponent<ElementType>;

  Comp.displayName = `Motion(${tag})`;
  cache.set(tag, Comp);
  return Comp;
};

export const motion = new Proxy(
  {},
  {
    get: (_, tag: string) => getMotionComponent(tag),
  }
) as Record<string, MotionComponent<ElementType>>;
