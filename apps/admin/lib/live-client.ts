export async function liveRequest<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api/live/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok)
    throw new Error(data.error ?? "The classroom request failed.");
  return data as T;
}
export function liveMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
export function localInput(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (key: string) => parts.find((item) => item.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function zonedIso(wallTime: string, timeZone: string) {
  const target = Date.parse(`${wallTime}:00Z`);
  if (!Number.isFinite(target))
    throw new Error("Enter a valid class date and time.");
  let guess = target;
  for (let pass = 0; pass < 4; pass++)
    guess +=
      target -
      Date.parse(`${localInput(new Date(guess).toISOString(), timeZone)}:00Z`);
  if (localInput(new Date(guess).toISOString(), timeZone) !== wallTime)
    throw new Error(
      "That time does not exist in this time zone. Choose a different time.",
    );
  return new Date(guess).toISOString();
}
