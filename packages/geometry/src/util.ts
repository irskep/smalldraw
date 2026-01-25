export function allValuesAreFinite(a: number, b: number, c: number, d: number) {
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    Number.isFinite(c) &&
    Number.isFinite(d)
  );
}
