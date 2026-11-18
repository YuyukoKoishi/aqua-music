/** NFKC 归一化：全角→半角、兼容字符折叠 */
export function NFKC(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim()
}
