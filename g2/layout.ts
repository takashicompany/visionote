// Even G2 display dimensions
export const DISPLAY_WIDTH = 576
export const DISPLAY_HEIGHT = 288

// Image container dimensions (200x100 each, 2x2 = 400x200)
export const CONTAINER_W = 200
export const CONTAINER_H = 100

// Full image dimensions
export const FULL_W = CONTAINER_W * 2  // 400
export const FULL_H = CONTAINER_H * 2  // 200

// Centered on display
const OFFSET_X = Math.floor((DISPLAY_WIDTH - FULL_W) / 2)   // 88
const OFFSET_Y = Math.floor((DISPLAY_HEIGHT - FULL_H) / 2)  // 44

// 2x2 grid of image containers
export const CONTAINERS = [
  { id: 2, name: 'img-tl', x: OFFSET_X,               y: OFFSET_Y },
  { id: 3, name: 'img-tr', x: OFFSET_X + CONTAINER_W,  y: OFFSET_Y },
  { id: 4, name: 'img-bl', x: OFFSET_X,               y: OFFSET_Y + CONTAINER_H },
  { id: 5, name: 'img-br', x: OFFSET_X + CONTAINER_W,  y: OFFSET_Y + CONTAINER_H },
] as const
