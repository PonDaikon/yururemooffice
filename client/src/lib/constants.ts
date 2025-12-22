export interface PrivateZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export const PRIVATE_ZONES: PrivateZone[] = [
  {
    id: 'meeting-room-1',
    name: 'Meeting Room A',
    x: 100,
    y: 100,
    width: 300,
    height: 250,
    color: 'from-blue-500/20 to-cyan-500/20'
  },

];

export const isPositionInZone = (x: number, y: number, zone: PrivateZone): boolean => {
  // Add offset for bubble center (assuming bubble is roughly 128x128, center is +64)
  const bubbleCenterX = x + 64;
  const bubbleCenterY = y + 64;
  
  return (
    bubbleCenterX >= zone.x &&
    bubbleCenterX <= zone.x + zone.width &&
    bubbleCenterY >= zone.y &&
    bubbleCenterY <= zone.y + zone.height
  );
};

export const getZoneForPosition = (x: number, y: number): string | null => {
  for (const zone of PRIVATE_ZONES) {
    if (isPositionInZone(x, y, zone)) {
      return zone.id;
    }
  }
  return null;
};
