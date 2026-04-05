// Even G2 display dimensions
export const DISPLAY_WIDTH = 576
export const DISPLAY_HEIGHT = 288

// Image container dimensions
export const CONTAINER_W = 200
export const CONTAINER_H = 100

// Cursor dimensions
export const CURSOR_W = 30
export const CURSOR_H = 30

// Grid layout: 2 columns with gap for cursor between them
const GAP = CURSOR_W                                          // 30
const GRID_W = CONTAINER_W * 2 + GAP                          // 430
const GRID_H = CONTAINER_H * 2                                // 200
const OFFSET_X = Math.floor((DISPLAY_WIDTH - GRID_W) / 2)     // 73
const OFFSET_Y = Math.floor((DISPLAY_HEIGHT - GRID_H) / 2)    // 44

// Full image dimensions (for image splitting)
export const FULL_W = CONTAINER_W * 2  // 400
export const FULL_H = CONTAINER_H * 2  // 200

// 2x2 grid of image containers
export const CONTAINERS = [
  { id: 2, name: 'img-tl', x: 90,  y: 20 },
  { id: 3, name: 'img-tr', x: 350, y: 20 },
  { id: 4, name: 'img-bl', x: 90,  y: 180 },
  { id: 5, name: 'img-br', x: 350, y: 180 },
] as const

// Cursor text container
export const CURSOR = {
  id: 6,
  name: 'cur',
  w: CURSOR_W,   // 30
  h: CURSOR_H,   // 30
} as const

