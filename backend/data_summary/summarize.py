import logging
from typing import Optional
import pandas as pd
import re
from .llm import LLMClient
from .file_utils import read_preview, read_full_dataframe, to_pandasai_dataframe
import unicodedata

logger = logging.getLogger("datasummary.summarize")

DEFAULT_PROMPT = """You are a data analyst performing an initial review of a file for a key business decision.
Examine the provided Excel file and create a brief metadata summary (up to 2 sentences) that covers the following:
1. Data Topic & Purpose: What the dataset includes and its intended use.
2. Notable Patterns: Find 1-2 significant insights like common categories, outliers, trends.
3. Do not mention the data quality in the file; just create the brief.
4. Make sure the description contains these: size (number of rows and columns).
5. List all the column names if they are not more than 10; if more than 10, list only the most important ones (skip unnamed ones).
Format: Plain text only. No code blocks, images, or charts.
You may include punctuation, special characters, and non-ASCII characters in the summary if they help convey meaning.
This summary will help determine if the file is suitable for further analysis."""
STALL_MSG = "Unfortunately, I was not able to get your answer. Please try again."


def _manual_description(df: pd.DataFrame) -> str:
    df = df.dropna(how="all").dropna(axis=1, how="all")
    n_rows, n_cols = df.shape
    cols = [str(c).strip().replace("\n", " ").replace("\r", " ") for c in df.columns]
    patterns = []
    for col in cols[:5]:
        s = df[col].dropna()
        if s.empty:
            continue
        dt = str(s.dtype)
        if "int" in dt or "float" in dt:
            patterns.append(f"{col} ranges {s.min()}–{s.max()}")
        elif "datetime" in dt:
            patterns.append(f"{col} spans {s.min()}–{s.max()}")
        else:
            vc = s.value_counts()
            if not vc.empty:
                patterns.append(f"{col} often '{vc.index[0]}'")
        if len(patterns) >= 2:
            break
    cols_text = f" Columns: {', '.join(cols)}." if n_cols <= 12 else ""
    pat_text = f" Notable: {', '.join(patterns)}." if patterns else ""
    return f"This file is a tabular dataset likely used for exploratory analysis or reporting with {n_rows} rows × {n_cols} columns.{cols_text}{pat_text}"


def sanitize_metadata_value(value: str) -> str:
    """
    Sanitize string for Azure Blob metadata values.
    - Removes non-ASCII control characters.
    - Converts spaces (including non-breaking spaces) to underscores.
    - Collapses multiple underscores.
    - Trims leading/trailing underscores.
    - Truncates to Azure's 8KB max value length.
    """
    if not isinstance(value, str):
        value = str(value)

    value = unicodedata.normalize("NFKC", value)

    value = re.sub(r"[\x00-\x1F\x7F]", "", value)

    value = value.replace("\u00a0", " ")

    value = re.sub(r"[^\x20-\x7E]", "", value)

    value = re.sub(r"_+", "_", value)

    value = value.strip("_")

    return value[:8192]


def create_description(
    path: str, llm: LLMClient, prompt: str = DEFAULT_PROMPT, max_retries: int = 3
) -> str:
    try:
        preview, _ = read_preview(path)
        if preview is not None:
            logger.info("Preview columns: %s", list(preview.columns))
            logger.info("Preview shape: %s", preview.shape)

        full_df = read_full_dataframe(path)
        pai_df = to_pandasai_dataframe(full_df)

        last_err: Optional[Exception] = None
        for attempt in range(1, max_retries + 1):
            try:
                resp = llm.summarize_dataframe(pai_df, prompt)


                # Handle PandasAI StringResponse
                if hasattr(resp, "value"):
                    resp = resp.value
                elif hasattr(resp, "__str__"):
                    resp = str(resp)

                text = (resp or "").strip()
                if not text or text == STALL_MSG:
                    logger.warning("LLM stall/empty on attempt %d", attempt)
                    continue

                # Optional: sanitize for Azure metadata if needed
                safe_text = sanitize_metadata_value(text)
                logger.info("Sanitized metadata: %s", safe_text)

                return safe_text
            except Exception as e:
                logger.exception("LLM error attempt %d: %s", attempt, e)
                last_err = e

        logger.warning("Falling back to manual description.")
        return _manual_description(full_df)

    except Exception as e:
        logger.exception("Critical error in create_description: %s", e)
        return f"Error processing file: {e}"
