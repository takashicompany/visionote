// Even G2 display dimensions
export const DISPLAY_WIDTH = 576
export const DISPLAY_HEIGHT = 288

// Full image dimensions (200x200, split into two 200x100 containers)
export const IMAGE_W = 200
export const IMAGE_H = 200
export const IMAGE_HALF_H = 100

// Position (centered)
export const IMAGE_X = Math.floor((DISPLAY_WIDTH - IMAGE_W) / 2)
export const IMAGE_Y = Math.floor((DISPLAY_HEIGHT - IMAGE_H) / 2)
export const IMAGE_TOP_Y = IMAGE_Y
export const IMAGE_BOTTOM_Y = IMAGE_Y + IMAGE_HALF_H
