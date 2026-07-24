export const RenderDirtyFlag = {
  none: 0,
  layout: 1 << 0,
  backdrop: 1 << 1,
  appearance: 1 << 2,
  transform: 1 << 3,
  motionCache: 1 << 4,
  cardPosition: 1 << 5,
} as const;

export type RenderDirtyFlags = number;

export const createRenderDirtyState = (initial: RenderDirtyFlags) => {
  let flags = initial;

  return {
    add(next: RenderDirtyFlags) {
      flags |= next;
    },
    clear(next: RenderDirtyFlags) {
      flags &= ~next;
    },
    has(next: RenderDirtyFlags) {
      return (flags & next) !== 0;
    },
    value() {
      return flags;
    },
  };
};
