import logging
from typing import Optional
import pandas as pd
import re
from .llm import LLMClient
from .file_utils import read_preview, read_full_dataframe, to_pandasai_dataframe, reduce_dataframe_for_fallback
import unicodedata

logger = logging.getLogger("datasummary.summarize")

DEFAULT_PROMPT = """You are a data analyst providing file descriptions for automated file selection.
Task: Examine the Excel file and provide a brief description (2-3 sentences) covering:
Content Type: What kind of data this file contains (e.g., sales records, customer list, inventory data, financial statements)
Key Dimensions: Main data categories/columns (do not include details of individual rows or columns, just summarize the categories) and rough size (number of rows/records)
Time Scope: Date range covered, if applicable
Output: Plain text description only.
Purpose: Help a coding agent understand what each file contains without opening it, enabling efficient file selection for analysis tasks."""

FALLBACK_PROMPT = """
Analyze the data and provide a brief explanation of the file in 2 sentences, focusing on optimized computations.
"""

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
) -> dict:
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
                if attempt == 1:
                    resp = llm.summarize_dataframe(pai_df, prompt)
                    description_source = "primary_llm"
                if attempt == 2:
                    pai_df = reduce_dataframe_for_fallback(pai_df)
                    resp = llm.summarize_dataframe(pai_df, prompt)
                    description_source = "primary_llm_fallback"
                else:
                    resp = llm.summarize_dataframe(pai_df, FALLBACK_PROMPT)
                    description_source = "secondary_llm_fallback"


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

                return {"file_description": safe_text, "source": description_source}
            except Exception as e:
                logger.exception("LLM error attempt %d: %s", attempt, e)
                last_err = e

        logger.warning("Falling back to manual description.")
        manual_description = _manual_description(full_df)
        return {"file_description": sanitize_metadata_value(manual_description), "source": "manual_summary" }

    except Exception as e:
        logger.exception("Critical error in create_description: %s", e)
        return f"Error processing file: {e}"
