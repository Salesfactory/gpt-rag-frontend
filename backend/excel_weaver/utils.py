import pandasai as pai
import pandas as pd
from dotenv import load_dotenv
from pandasai_openai import AzureOpenAI
import os

from pandasai import DataFrame

# Load environment variables
load_dotenv()

DEFAULT_PROMPT = """You are a data analyst performing an initial review of a file for a key business decision.
Examine the provided Excel file and create a brief metadata summary (up to 2 sentences) that covers the following:
1. **Data Topic & Purpose**: What the dataset includes and its intended use.
2. **Notable Patterns**: Find 1-2 significant insights like common categories, outliers, trends
3.Dont mention the data quality in the file just create the brief
4. make sure in the description contains these: size (number of rows and columns)
5. list all the column names if they not a lot
Format: Plain text only. No code blocks, images, or charts.
This summary will help determine if the file is suitable for further analysis."""


# Azure OpenAI configuration
AZURE_OPENAI_ENDPOINT = os.getenv("O1_ENDPOINT")
AZURE_OPENAI_API_TOKEN = os.getenv("O1_KEY")
AZURE_OPENAI_DEPLOYMENT_NAME = "gpt-4.1"
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")

# Initialize LLM
llm = AzureOpenAI(
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    api_token=AZURE_OPENAI_API_TOKEN,
    deployment_name=AZURE_OPENAI_DEPLOYMENT_NAME,
    api_version=AZURE_OPENAI_API_VERSION
)

# Configure PandasAI
pai.config.set({
    "llm": llm,
    "save_logs": False,
    "save_charts": False,
    "return_code": False,
    "enable_charts": False,
    "verbose": False
})

def create_description(file):
    try:
        print(f"Processing file: {file}")
        
        # Detect file type
        file_extension = os.path.splitext(file)[1].lower()
        print(f"File extension detected: {file_extension}")
        
        df_preview = None
        is_csv = file_extension == '.csv'
        
        if is_csv:
            try:
                print("Processing as CSV file...")
                # Try different encoding and delimiter options for CSV
                encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
                delimiters = [',', ';', '\t', '|']
                
                for encoding in encodings:
                    for delimiter in delimiters:
                        try:
                            df_preview = pd.read_csv(file, encoding=encoding, sep=delimiter, nrows=5)
                            if len(df_preview.columns) > 1:  # Successfully parsed with multiple columns
                                print(f"CSV successfully read with encoding={encoding}, delimiter='{delimiter}'")
                                break
                        except Exception as e:
                            continue
                    if df_preview is not None and len(df_preview.columns) > 1:
                        break
                
                if df_preview is None or len(df_preview.columns) <= 1:
                    # Fallback: try with Python's csv sniffer
                    import csv
                    with open(file, 'r', encoding='utf-8') as f:
                        sample = f.read(1024)
                        sniffer = csv.Sniffer()
                        delimiter = sniffer.sniff(sample).delimiter
                        print(f"CSV sniffer detected delimiter: '{delimiter}'")
                    df_preview = pd.read_csv(file, sep=delimiter, nrows=5)
                
            except Exception as e:
                print(f"Error inspecting CSV file: {e}")
        else:
            # Handle Excel files
            try:
                print("Processing as Excel file...")
                excel_file = pd.ExcelFile(file)
                sheet_names = excel_file.sheet_names
                print(f"Available sheets: {sheet_names}")
                
                # Read the first sheet with different header options
                for header_row in [0, 1, 2, None]:
                    try:
                        df_preview = pd.read_excel(file, sheet_name=0, header=header_row, nrows=5)
                        if not df_preview.empty and not all(col.startswith('Unnamed:') for col in df_preview.columns):
                            print(f"Successfully read with header={header_row}")
                            break
                    except Exception as e:
                        print(f"Failed to read with header={header_row}: {e}")
                        continue
                
            except Exception as e:
                print(f"Error inspecting Excel file: {e}")
        
        # Display preview information
        if df_preview is not None:
            print("Column names found:")
            for i, col in enumerate(df_preview.columns):
                print(f"  {i}: '{col}' (type: {df_preview[col].dtype})")
            print(f"Shape: {df_preview.shape}")
            print("First few rows:")
            print(df_preview.head())
        
        # Now try to use PandasAI with error handling
        try:
            if is_csv:
                df = pai.read_csv(file)
                print(f"PandasAI successfully loaded CSV with shape: {df.shape}")
            else:
                df = pai.read_excel(file)
                print(f"PandasAI successfully loaded Excel with shape: {df.shape}")
            print(f"Columns: {list(df.columns)}")
        except Exception as e:
            print(f"Error reading with PandasAI: {e}")
            # Fallback: read with pandas and create PandasAI DataFrame
            if is_csv:
                df_pandas = pd.read_csv(file)
            else:
                df_pandas = pd.read_excel(file)
            
            # Clean column names
            df_pandas.columns = df_pandas.columns.astype(str)
            df_pandas.columns = [col.strip().replace('\n', ' ').replace('\r', ' ') for col in df_pandas.columns]
            df = DataFrame(df_pandas)
            print(f"Fallback successful. Shape: {df.shape}")
            print(f"Cleaned columns: {list(df.columns)}")
        
        
        # Try to get response with retries
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Attempt {attempt + 1} to generate response...")
                response = df.chat(DEFAULT_PROMPT)
                if response and len(str(response).strip()) > 0:
                    if response == "Unfortunately, I was not able to get your answer. Please try again.":
                        print(f"Unfortunately, I was not able to get your answer. Trying again {attempt + 1}")
                    return response
                else:
                    print(f"Empty response on attempt {attempt + 1}")
            except Exception as e:
                print(f"Error on attempt {attempt + 1}: {e}")
                if attempt == max_retries - 1:
                    # Final fallback: create manual description
                    return create_manual_description(df)
        
        return "Unable to generate description after multiple attempts."
        
    except Exception as e:
        print(f"Critical error in create_description: {e}")
        return f"Error processing file: {str(e)}"


def create_manual_description(df: DataFrame):
    """Create a basic description without using AI when PandasAI fails"""
    try:
        description = []

        # Drop fully empty rows and columns
        df = df.dropna(how="all").dropna(axis=1, how="all")

        if df.empty or df.shape[1] == 0:
            return "Dataset is empty or has no valid columns after cleaning."

        # Basic info
        description.append(f"Dataset contains {len(df)} rows and {len(df.columns)} columns.")

        # First column values
        first_col_name = df.columns[0]
        first_col_values = df[first_col_name].dropna().unique()[:5].tolist()
        description.append(f"First column ({first_col_name}) sample values: {first_col_values}")

        # First row values
        if not df.empty:
            first_row_values = df.iloc[0].to_dict()
            description.append(f"First row sample: {first_row_values}")

        # Column type info
        col_info = []
        for col in df.columns[:10]:  # Limit to first 10 columns
            dtype = str(df[col].dtype)
            non_null = df[col].count()

            if dtype in ['object', 'string']:
                unique_count = df[col].nunique()
                col_info.append(f"{col} (text, {unique_count} unique values)")
            elif 'int' in dtype or 'float' in dtype:
                min_val = df[col].min() if non_null > 0 else 'N/A'
                max_val = df[col].max() if non_null > 0 else 'N/A'
                col_info.append(f"{col} (numeric, range: {min_val}-{max_val})")
            elif 'datetime' in dtype:
                min_date = df[col].min() if non_null > 0 else 'N/A'
                max_date = df[col].max() if non_null > 0 else 'N/A'
                col_info.append(f"{col} (date, range: {min_date} to {max_date})")

        if col_info:
            description.append(f"Key columns: {', '.join(col_info[:5])}")

        # Missing data info
        missing_data = df.isnull().sum()
        if missing_data.sum() > 0:
            cols_with_missing = missing_data[missing_data > 0]
            description.append(f"Missing data found in {len(cols_with_missing)} columns.")

        return " ".join(description)

    except Exception as e:
        return f"Unable to create description: {str(e)}"
