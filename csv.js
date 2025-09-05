export function quoteCSV(s) {
  const str = String(s ?? "");
  return '"' + str.replaceAll('"', '""') + '"';
}
