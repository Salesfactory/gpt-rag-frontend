import csv, os, logging
from typing import Optional, Tuple
import pandas as pd
import io
import tempfile
import shutil

logger = logging.getLogger("datasummary.file_utils")

def detect_extension(path: str) -> str:
    return os.path.splitext(path)[1].lower()

def try_read_csv_preview(path: str, nrows: int = 5) -> Optional[pd.DataFrame]:
    encodings = ["utf-8", "latin-1", "cp1252", "iso-8859-1"]
    delimiters = [",", ";", "\t", "|"]
    for enc in encodings:
        for sep in delimiters:
            try:
                df = pd.read_csv(path, encoding=enc, sep=sep, nrows=nrows)
                if df is not None and df.shape[1] > 1:
                    return df
            except Exception:
                continue
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            sample = f.read(4096)
            try:
                sep = csv.Sniffer().sniff(sample).delimiter
            except Exception:
                sep = ","
        return pd.read_csv(path, sep=sep, nrows=nrows, encoding="utf-8", engine="python")
    except Exception as e:
        logger.warning("CSV preview failed: %s", e)
        return None

def try_read_excel_preview(path: str, nrows: int = 5) -> Optional[pd.DataFrame]:
    try:
        pd.ExcelFile(path)  # validate file
        for header in [0, 1, 2, None]:
            try:
                df = pd.read_excel(path, sheet_name=0, header=header, nrows=nrows)
                cols = [str(c) for c in df.columns]
                if not df.empty and not all(c.startswith("Unnamed:") for c in cols):
                    return df
            except Exception:
                continue
    except Exception as e:
        logger.warning("Excel preview failed: %s", e)
    return None

def read_full_dataframe(path: str) -> pd.DataFrame:
    if detect_extension(path) == ".csv":
        try:
            return pd.read_csv(path)
        except Exception:
            return pd.read_csv(path, engine="python")
    return pd.read_excel(path)

def read_preview(path: str) -> Tuple[Optional[pd.DataFrame], bool]:
    ext = detect_extension(path)
    if ext == ".csv":
        return try_read_csv_preview(path), True
    return try_read_excel_preview(path), False

def to_pandasai_dataframe(df: pd.DataFrame):
    from pandasai import DataFrame as PAIDF
    df = df.copy()
    df.columns = df.columns.astype(str)
    df.columns = [c.strip().replace("\n", " ").replace("\r", " ") for c in df.columns]
    return PAIDF(df)

def bytesio_to_tempfile(byte_data: io.BytesIO, suffix: str) -> str:
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    byte_data.seek(0)  # rewind
    shutil.copyfileobj(byte_data, temp)
    temp.close()
    return str(temp.name)  # full path to the temp file