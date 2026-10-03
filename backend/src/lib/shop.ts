export function makeShopCode(ownerName: string, seq = 1024): string {
  const initials = ownerName
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  return `PF-${initials}-${seq}`;
}

export function priceFor(pages: number, copies: number, colorMode: 'BW' | 'COLOR', bw: number, color: number): number {
  const per = colorMode === 'BW' ? bw : color;
  return pages * copies * per;
}
