export function outlineToPath(outline: number[][]): string {
  if (outline.length < 4) {
    return "";
  }
  const average = (a: number, b: number) => (a + b) / 2;
  let a = outline[0];
  let b = outline[1];
  const c = outline[2];
  let result = `M${a[0]},${a[1]} Q${b[0]},${b[1]} ${average(
    b[0],
    c[0],
  )},${average(b[1], c[1])} T`;
  for (let i = 2, max = outline.length - 1; i < max; i += 1) {
    a = outline[i];
    b = outline[i + 1];
    result += `${average(a[0], b[0])},${average(a[1], b[1])} `;
  }
  result += "Z";
  return result;
}
