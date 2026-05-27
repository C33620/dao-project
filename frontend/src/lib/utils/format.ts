export function formatAddress(value?: string) {
  if (!value) return "Not connected";
  if (value.length < 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function titleCase(value: string) {
  return value
    .split(/[-_\\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
