// Positional astronomy for the sky chart. No dependencies, so it runs in the browser and in Node.
//
//   catalogue (J2000 RA/Dec) --precession--> RA/Dec of date --sidereal time--> hour angle
//   --observer latitude--> altitude/azimuth --stereographic projection--> x, y on the card
//
// Formulas: J. Meeus, "Astronomical Algorithms" (2nd ed.), chapters 12, 13 and 21.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export const normalize = (deg) => ((deg % 360) + 360) % 360;

/** Julian Date of a JavaScript Date (UTC). */
export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Julian centuries since J2000.0. */
export const centuries = (jd) => (jd - 2451545.0) / 36525;

/** Greenwich mean sidereal time in degrees (Meeus 12.4). */
export function gmst(date) {
  const jd = julianDate(date);
  const t = centuries(jd);
  return normalize(280.46061837 + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * t * t - (t * t * t) / 38710000);
}

/** Local mean sidereal time in degrees; east longitude is positive. */
export const lst = (date, lon) => normalize(gmst(date) + lon);

/**
 * Precession angles from J2000.0 to the given date (Meeus 21.2), in degrees.
 * The returned function moves a J2000 position [ra, dec] to the equinox of date.
 */
export function precessor(date) {
  const t = centuries(julianDate(date));
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) / 3600;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) / 3600;
  const ct = Math.cos(theta * RAD), st = Math.sin(theta * RAD);
  return (ra, dec) => {
    const a = (ra + zeta) * RAD, d = dec * RAD;
    const A = Math.cos(d) * Math.sin(a);
    const B = ct * Math.cos(d) * Math.cos(a) - st * Math.sin(d);
    const C = st * Math.cos(d) * Math.cos(a) + ct * Math.sin(d);
    return [normalize(Math.atan2(A, B) * DEG + z), Math.asin(Math.max(-1, Math.min(1, C))) * DEG];
  };
}

/**
 * Altitude and azimuth (degrees) of an equatorial position for an observer.
 * Azimuth is measured from north through east. `siderealTime` is the local sidereal time.
 */
export function horizontal(ra, dec, lat, siderealTime) {
  const h = (siderealTime - ra) * RAD;
  const d = dec * RAD, phi = lat * RAD;
  const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.cos(d) * Math.sin(h),
    Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.sin(phi) * Math.cos(h));
  return { alt: alt * DEG, az: normalize(az * DEG) };
}

/**
 * Everything needed to place J2000 catalogue positions on the sky of one observer at one
 * moment. Returns a function (ra, dec) -> {alt, az}.
 */
export function observer(date, lat, lon) {
  const precess = precessor(date);
  const theta = lst(date, lon);
  return (ra, dec) => {
    const [r, d] = precess(ra, dec);
    return horizontal(r, d, lat, theta);
  };
}

/**
 * Stereographic projection centred on the zenith, as seen lying on your back with north
 * at the top: east is on the LEFT, west on the right. The horizon maps to `radius`.
 */
export function project(alt, az, radius) {
  const r = radius * Math.tan(((90 - alt) / 2) * RAD);
  return [-r * Math.sin(az * RAD), -r * Math.cos(az * RAD)];
}

// --- Time zones ---------------------------------------------------------------------------

/** Offset of `timeZone` from UTC, in minutes, at the instant `date`. */
export function zoneOffset(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** The UTC instant of a wall-clock time in `timeZone` (month is 1-12). */
export function zonedTime(year, month, day, hour, minute, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wall - zoneOffset(new Date(wall), timeZone) * 60000;
  guess = wall - zoneOffset(new Date(guess), timeZone) * 60000; // second pass settles DST edges
  return new Date(guess);
}

// --- Star colours -------------------------------------------------------------------------

/** Approximate colour of a star from its B-V index (Ballesteros 2012 temperature + blackbody fit). */
export function starColor(bv) {
  bv = Math.max(-0.4, Math.min(2.0, bv));
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  // Tanner Helland's blackbody approximation
  const k = t / 100;
  const r = k <= 66 ? 255 : 329.698727446 * (k - 60) ** -0.1332047592;
  const g = k <= 66 ? 99.4708025861 * Math.log(k) - 161.1195681661 : 288.1221695283 * (k - 60) ** -0.0755148492;
  const b = k >= 66 ? 255 : k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  const c = (v) => Math.round(Math.max(0, Math.min(255, v)));
  return [c(r), c(g), c(b)];
}
