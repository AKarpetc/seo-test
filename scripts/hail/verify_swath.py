"""H-G2: does a radar hail swath (MRMS MESH) agree with ground hail reports?

Builds a swath from the MRMS MESH 24-hour maximum grid (IEM archive, 0.01 deg ~1 km)
for one convective day (12Z to 12Z) and checks ground reports from NCEI Storm Events
against it. A report counts as a match when MESH >= the size threshold (1" = 25.4 mm)
anywhere within TOL_KM of the report point. Reports carry location error of a few km
("2 N Town"), so the strict same-cell result is printed too.

The 10 reports for the gate are drawn at random (fixed seed) from Storm Events hail
reports >= 1" of that day; full-day match rates for Storm Events and the SPC daily
file are printed for context. A second swath from NCEI SWDI nx3hail cell points
(buffered by TOL_KM) is checked the same way.

Raw downloads go to IncomeApps/analysis/data/hail/ (gitignored), not into this repo.

    python3 -m venv .venv && .venv/bin/pip install pandas numpy pygrib
    .venv/bin/python scripts/hail/verify_swath.py            # default day 2026-04-28
    .venv/bin/python scripts/hail/verify_swath.py 2026-05-16
"""

import datetime as dt
import gzip
import io
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import pygrib

DATA = Path(__file__).resolve().parents[4] / 'analysis' / 'data' / 'hail'
THRESH_IN = 1.0
TOL_KM = 3.0
SAMPLE = 10
SEED = 20260929

MESH_URL = 'https://mtarchive.geol.iastate.edu/{d:%Y/%m/%d}/mrms/ncep/MESH_Max_1440min/MESH_Max_1440min_00.50_{d:%Y%m%d}-120000.grib2.gz'
SPC_URL = 'https://www.spc.noaa.gov/climo/reports/{d:%y%m%d}_rpts_hail.csv'
SE_URL = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'
SWDI_URL = 'https://www.ncei.noaa.gov/swdiws/csv/nx3hail/{a:%Y%m%d%H}:{b:%Y%m%d%H}?bbox={bbox}'

# MRMS CONUS grid: 7000 x 3500 cells of 0.01 deg, first row at 54.995N, first column at 130.005W
LAT0, LON0, STEP, NY, NX = 54.995, -129.995, 0.01, 3500, 7000


def fetch(url: str, name: str) -> Path:
    path = DATA / name
    if not path.exists():
        DATA.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=300) as r:
            path.write_bytes(r.read())
    return path


def load_mesh(day: dt.date) -> np.ndarray:
    end = day + dt.timedelta(days=1)
    gz = fetch(MESH_URL.format(d=end), f'MESH_Max_1440min_{end:%Y%m%d}-120000.grib2.gz')
    grib = gz.with_suffix('')
    if not grib.exists():
        grib.write_bytes(gzip.decompress(gz.read_bytes()))
    with pygrib.open(str(grib)) as g:
        return np.asarray(g[1].values, dtype=float)  # mm; negative = no data


def storm_events(day: dt.date) -> pd.DataFrame:
    listing = urllib.request.urlopen(SE_URL, timeout=120).read().decode()
    stem = f'StormEvents_details-ftp_v1.0_d{day.year}_c'
    name = sorted(set(re.findall(re.escape(stem) + r'(\d{8}\.csv\.gz)', listing)))[-1]
    df = pd.read_csv(fetch(SE_URL + stem + name, stem + name), low_memory=False)
    df = df[(df.EVENT_TYPE == 'Hail') & df.BEGIN_LAT.notna()].copy()
    # Storm Events times are local standard time, e.g. CST-6
    offset = df.CZ_TIMEZONE.str.extract(r'(-?\d+)$')[0].astype(int)
    local = pd.to_datetime(df.BEGIN_DATE_TIME, format='%d-%b-%y %H:%M:%S')
    df['utc'] = local - pd.to_timedelta(offset, unit='h')
    start = pd.Timestamp(day) + pd.Timedelta(hours=12)
    df = df[(df.utc >= start) & (df.utc < start + pd.Timedelta(days=1))]
    return df.rename(columns={'BEGIN_LAT': 'lat', 'BEGIN_LON': 'lon', 'MAGNITUDE': 'size'})


def spc_reports(day: dt.date) -> pd.DataFrame:
    df = pd.read_csv(fetch(SPC_URL.format(d=day), f'spc_{day:%y%m%d}_rpts_hail.csv'))
    df = df.rename(columns={'Lat': 'lat', 'Lon': 'lon'})
    df['size'] = df.Size / 100.0
    return df


def swdi_points(day: dt.date, frame: pd.DataFrame) -> pd.DataFrame:
    a = dt.datetime.combine(day, dt.time(12))
    b = a + dt.timedelta(days=1)
    parts = []
    # the API caps a box at 15 x 15 degrees; tile the reports' extent
    for lat in np.arange(np.floor(frame.lat.min()), frame.lat.max() + 1, 10):
        for lon in np.arange(np.floor(frame.lon.min()), frame.lon.max() + 1, 10):
            bbox = f'{lon - 1},{lat - 1},{lon + 11},{lat + 11}'
            name = f'swdi_{day:%Y%m%d}_{lon:.0f}_{lat:.0f}.csv'
            text = fetch(SWDI_URL.format(a=a, b=b, bbox=bbox), name).read_text()
            body = text.split('\nsummary')[0]
            if body.count('\n') > 0:
                parts.append(pd.read_csv(io.StringIO(body)))
    pts = pd.concat(parts).drop_duplicates() if parts else pd.DataFrame(columns=['LAT', 'LON', 'MAXSIZE'])
    return pts.rename(columns={'LAT': 'lat', 'LON': 'lon'})


def mesh_near(mesh: np.ndarray, lat: float, lon: float, km: float) -> float:
    row, col = round((LAT0 - lat) / STEP), round((lon - LON0) / STEP)
    dr = int(np.ceil(km / 111.0 / STEP))
    dc = int(np.ceil(km / (111.0 * np.cos(np.radians(lat))) / STEP))
    win = mesh[max(row - dr, 0):row + dr + 1, max(col - dc, 0):col + dc + 1]
    return float(win.max()) if win.size else -1.0


def near_points(pts: pd.DataFrame, lat: float, lon: float, km: float) -> float:
    if pts.empty:
        return 0.0
    d = 111.0 * np.hypot(pts.lat - lat, (pts.lon - lon) * np.cos(np.radians(lat)))
    close = pts[d <= km]
    return float(close.MAXSIZE.max()) if len(close) else 0.0


def score(df: pd.DataFrame, mesh: np.ndarray, pts: pd.DataFrame) -> pd.DataFrame:
    thr = THRESH_IN * 25.4
    df = df.copy()
    df['mesh_cell_in'] = [mesh_near(mesh, a, o, 0) / 25.4 for a, o in zip(df.lat, df.lon)]
    df['mesh_tol_in'] = [mesh_near(mesh, a, o, TOL_KM) / 25.4 for a, o in zip(df.lat, df.lon)]
    df['nx3_tol_in'] = [near_points(pts, a, o, TOL_KM) for a, o in zip(df.lat, df.lon)]
    df['hit_cell'] = df.mesh_cell_in * 25.4 >= thr
    df['hit_tol'] = df.mesh_tol_in * 25.4 >= thr
    df['hit_nx3'] = df.nx3_tol_in >= THRESH_IN
    return df


def main() -> None:
    day = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date(2026, 4, 28)
    mesh = load_mesh(day)
    area = int((mesh >= THRESH_IN * 25.4).sum())
    print(f'Convective day {day} 12Z -> {day + dt.timedelta(days=1)} 12Z')
    print(f'MESH 24h max: peak {mesh.max() / 25.4:.1f}", swath >= {THRESH_IN}" covers ~{area} km2 (1 cell ~ 1 km2)')

    se = storm_events(day)
    se1 = se[se['size'] >= THRESH_IN]
    spc = spc_reports(day)
    spc1 = spc[spc['size'] >= THRESH_IN]
    pts = swdi_points(day, se1)
    print(f'Storm Events hail reports >= {THRESH_IN}": {len(se1)}; SPC daily: {len(spc1)}; nx3hail cell points: {len(pts)}')

    sample = score(se1.sample(n=min(SAMPLE, len(se1)), random_state=SEED), mesh, pts)
    cols = ['utc', 'STATE', 'BEGIN_LOCATION', 'lat', 'lon', 'size', 'mesh_cell_in', 'mesh_tol_in', 'nx3_tol_in', 'hit_cell', 'hit_tol', 'hit_nx3']
    print(f'\nGate sample: {len(sample)} random Storm Events reports (seed {SEED}), tolerance {TOL_KM} km')
    print(sample[cols].sort_values('utc').to_string(index=False, float_format=lambda x: f'{x:.2f}'))
    print(f'\nMESH swath: {int(sample.hit_tol.sum())}/{len(sample)} within {TOL_KM} km, '
          f'{int(sample.hit_cell.sum())}/{len(sample)} same cell; nx3hail: {int(sample.hit_nx3.sum())}/{len(sample)}')

    for name, frame in (('Storm Events', se1), ('SPC daily', spc1)):
        s = score(frame, mesh, pts)
        print(f'All {name} reports >= {THRESH_IN}": MESH within {TOL_KM} km {s.hit_tol.mean():.0%}, '
              f'same cell {s.hit_cell.mean():.0%}, nx3hail {s.hit_nx3.mean():.0%} (n={len(s)})')


if __name__ == '__main__':
    main()
