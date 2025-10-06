import markdown
from rp2email import ReportProcessor
from financial_doc_processor import *
from utils import *
from sec_edgar_downloader import Downloader
from app_config import FILING_TYPES, BASE_FOLDER
from flask import (
    Blueprint,
    current_app,
    request,
    jsonify,
)
from routes.decorators.auth_decorator import auth_required
bp = Blueprint("users", __name__)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)



doc_processor = FinancialDocumentProcessor()  # from financial_doc_processor


@bp.route("/api/SECEdgar/financialdocuments", methods=["GET"])
@auth_required
def process_edgar_document(*, context):
    """
    Process a single financial document from SEC EDGAR.

    Args for payload:
        equity_id (str): Stock symbol/ticker (e.g., 'AAPL')
        filing_type (str): SEC filing type (e.g., '10-K')
        after_date (str, optional): Filter for filings after this date (YYYY-MM-DD)

    Returns:
        JSON Response with processing status and results

    Raises:
        400: Invalid request parameters
        404: Document not found
        500: Internal server error
    """
    try:
        # Validate request and setup
        if not check_and_install_wkhtmltopdf():
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Failed to install required dependency wkhtmltopdf",
                        "code": 500,
                    }
                ),
                500,
            )

        # Get and validate parameters
        data = request.get_json()
        if not data:
            return (
                jsonify(
                    {"status": "error", "message": "No data provided", "code": 400}
                ),
                400,
            )

        # Extract and validate parameters
        equity_id = data.get("equity_id")
        filing_type = data.get("filing_type")
        after_date = data.get("after_date", None)

        if not equity_id or not filing_type:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Both equity_id and filing_type are required",
                        "code": 400,
                    }
                ),
                400,
            )

        if filing_type not in FILING_TYPES:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Invalid filing type. Must be one of: {FILING_TYPES}",
                        "code": 400,
                    }
                ),
                400,
            )

        # Download filing
        download_result = doc_processor.download_filing(
            equity_id, filing_type, after_date
        )

        if download_result.get("status") != "success":
            return jsonify(download_result), download_result.get("code", 500)

        # Process and upload document
        upload_result = doc_processor.process_and_upload(equity_id, filing_type)
        return jsonify(upload_result), upload_result.get("code", 500)

    except Exception as e:
        logger.error(f"API execution failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e), "code": 500}), 500


from tavily_tool import TavilySearch

from app_config import IMAGE_PATH
from summarization import DocumentSummarizer


@bp.route("/api/SECEdgar/financialdocuments/summary", methods=["POST"])
@auth_required
def generate_summary(*, context):
    """
    Endpoint to generate a summary of financial documents from SEC Edgar.

    Request Payload Example:
    {
        "equity_name": "MS",          # The name of the equity (e.g., 'MS' for Morgan Stanley)
        "financial_type": "10-K"      # The type of financial document (e.g., '10-K' for annual reports)
    }

    Required Fields:
    - equity_name (str): The name of the equity.
    - financial_type (str): The type of financial document.

    Both fields must be non-empty strings.
    """
    try:
        try:
            data = request.get_json()
            if not data:
                return (
                    jsonify(
                        {
                            "error": "Invalid request",
                            "details": "Request body is requred and must be a valid JSON object",
                        }
                    ),
                    400,
                )
            equity_name = data.get("equity_name")
            financial_type = data.get("financial_type")

            if not all([equity_name, financial_type]):
                return (
                    jsonify(
                        {
                            "error": "Missing required fields",
                            "details": "equity_name and financial_type are required",
                        }
                    ),
                    400,
                )

            if not isinstance(equity_name, str) or not isinstance(financial_type, str):
                return (
                    jsonify(
                        {
                            "error": "Invalid input type",
                            "details": "equity_name and financial_type must be strings",
                        }
                    ),
                    400,
                )

            if not equity_name.strip() or not financial_type.strip():
                return (
                    jsonify(
                        {
                            "error": "Empty input",
                            "details": "equity_name and financial_type cannot be empty",
                        }
                    ),
                    400,
                )

        except ValueError as e:
            return (
                jsonify(
                    {
                        "error": "Invalid input",
                        "details": f"Failed to parse request body: {str(e)}",
                    }
                ),
                400,
            )

        # Initialize components with error handling
        try:
            blob_manager = BlobStorageManager()
            summarizer = DocumentSummarizer()
        except ConnectionError as e:
            logging.error(f"Failed to connect to blob storage: {e}")
            return (
                jsonify(
                    {
                        "error": "Connection error",
                        "details": "Failed to connect to storage service",
                    }
                ),
                503,
            )
        except Exception as e:
            logging.error(f"Failed to initialize components: {e}")
            return (
                jsonify({"error": "Service initialization failed", "details": str(e)}),
                500,
            )

        # Reset directories
        try:
            reset_local_dirs()
        except PermissionError as e:
            logging.error(f"Permission error while cleaning up directories: {str(e)}")
            return (
                jsonify(
                    {
                        "error": "Permission error",
                        "details": "Failed to clean up directories due to permission issues",
                    }
                ),
                500,
            )
        except OSError as e:
            logging.error(f"OS error while reseting directories: {str(e)}")
            return (
                jsonify(
                    {
                        "error": "System error",
                        "details": "Failed to prepare working directories",
                    }
                ),
                500,
            )
        except Exception as e:
            logging.error(f"Failed to clean up directories: {e}")
            return (
                jsonify(
                    {
                        "error": "Cleanup failed",
                        "details": "Failed to clean up directories to prepare for processing",
                    }
                ),
                500,
            )

        # Download documents

        downloaded_files = blob_manager.download_documents(
            equity_name=equity_name, financial_type=financial_type
        )

        # Process documents
        for file_path in downloaded_files:
            doc_id = extract_pdf_pages_to_images(file_path, IMAGE_PATH)

        # Generate summaries
        all_summaries = summarizer.process_document_images(IMAGE_PATH)
        final_summary = summarizer.generate_final_summary(all_summaries)

        # note from Nam: we don't need to format the summary anymore since we instructed the LLM to format the final summary in the prompt already
        html_output = markdown.markdown(final_summary)

        # Save the summary locally
        # save_str_to_pdf(formatted_summary, local_output_path)

        local_output_path = f"pdf/{equity_name}_{financial_type}_{datetime.now().strftime('%b %d %y')}_summary.pdf"

        try:
            report_processor = ReportProcessor()

            pdf_path = report_processor.html_to_pdf(html_output, local_output_path)
            if not pdf_path:
                return jsonify({"error": "PDF creation failed"}), 500
        except Exception as e:
            logger.error(f"Failed to create PDF: {str(e)}")
            return jsonify({"error": "PDF creation failed: " + str(e)}), 500

        # Upload summary to blob
        document_paths = create_document_paths(
            local_output_path, equity_name, financial_type
        )

        # upload to blob and get the blob path/remote links
        upload_results = blob_manager.upload_to_blob(document_paths)

        blob_path = upload_results[equity_name][financial_type]["blob_path"]
        blob_url = upload_results[equity_name][financial_type]["blob_url"]

        # Clean up local directories
        try:
            reset_local_dirs()
        except Exception as e:
            logging.error(f"Failed to clean up directories: {e}")

        return (
            jsonify(
                {
                    "status": "success",
                    "equity_name": equity_name,
                    "financial_type": financial_type,
                    "blob_path": blob_path,
                    "remote_blob_url": blob_url,
                    "summary": final_summary,
                }
            ),
            200,
        )

    except Exception as e:
        logging.error(f"Unexpected error: {e}", exc_info=True)
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
    finally:
        # Ensure cleanup happens
        try:
            reset_local_dirs()
        except PermissionError as e:
            logging.error(f"Permission error while cleaning up directories: {str(e)}")
        except OSError as e:
            logging.error(f"OS error while reseting directories: {str(e)}")
        except Exception as e:
            logging.error(f"Failed to clean up: {e}")


from utils import _extract_response_data


@bp.route("/api/SECEdgar/financialdocuments/process-and-summarize", methods=["POST"])
@auth_required
def process_and_summarize_document(*, context):
    """
    Process and summarize a financial document in sequence.

    Args:
        equity_id (str): Stock symbol/ticker (e.g., 'AAPL')
        filing_type (str): SEC filing type (e.g., '10-K')
        after_date (str, optional): Filter for filings after this date (YYYY-MM-DD)

    Returns:
        JSON Response with structure:
        {
            "status": "success",
            "edgar_data_process": {...},
            "summary_process": {...}
        }

    Raises:
        400: Invalid request parameters
        404: Document not found
        500: Internal server error
    """
    # Input validation
    try:
        data = request.get_json()
        if not data:
            return (
                jsonify(
                    {
                        "status": "error",
                        "error": "Invalid request",
                        "details": "Request body is requred and must be a valid JSON object",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ),
                400,
            )

        # Validate required fields
        required_fields = ["equity_id", "filing_type"]
        if not all(field in data for field in required_fields):
            return (
                jsonify(
                    {
                        "status": "error",
                        "error": "Missing required fields",
                        "details": f"Missing required fields: {', '.join(required_fields)}",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ),
                400,
            )

        # Validate filing type
        if data["filing_type"] not in FILING_TYPES:
            return (
                jsonify(
                    {
                        "status": "error",
                        "error": "Invalid filing type",
                        "details": f"Invalid filing type. Must be one of: {', '.join(FILING_TYPES)}",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ),
                400,
            )

        # Validate date format if provided
        if "after_date" in data:
            try:
                datetime.strptime(data["after_date"], "%Y-%m-%d")
            except ValueError:
                return (
                    jsonify(
                        {
                            "status": "error",
                            "error": "Invalid date format",
                            "details": "Use YYYY-MM-DD",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                    400,
                )

    except ValueError as e:
        logger.error(f"Invalid request data: {str(e)}")
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Invalid request data",
                    "details": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ),
            400,
        )

    try:
        # Step 1: Process document
        logger.info(
            f"Starting document processing for {data['equity_id']} {data['filing_type']}"
        )
        with current_app.test_request_context(
            "/api/SECEdgar/financialdocuments", method="GET", json=data
        ) as ctx:
            process_result = process_edgar_document()
            process_data = _extract_response_data(process_result)

            if process_data.get("status") != "success":
                logger.error(
                    f"Document processing failed: {process_data.get('message')}"
                )
                if process_data.get("code") == 404:
                    return (
                        jsonify(
                            {
                                "status": "not_found",
                                "error": process_data.get("message"),
                                "code": process_data.get("code"),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        404,
                    )
                else:
                    return (
                        jsonify(
                            {
                                "status": "error",
                                "error": process_data.get("message"),
                                "code": process_data.get(
                                    "code", HTTPStatus.INTERNAL_SERVER_ERROR
                                ),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        500,
                    )

        # Step 2: Generate summary
        logger.info(
            f"Starting summary generation for {data['equity_id']} {data['filing_type']}"
        )
        summary_payload = {
            "equity_name": data["equity_id"],
            "financial_type": data["filing_type"],
        }

        with current_app.test_request_context(
            "/api/SECEdgar/financialdocuments/summary",
            method="POST",
            json=summary_payload,
        ) as ctx:
            summary_result = generate_summary()
            summary_data = _extract_response_data(summary_result)

            if summary_data.get("status") != "success":
                logger.error(
                    f"Summary generation failed: {summary_data.get('message')}"
                )
                return (
                    jsonify(
                        {
                            "status": "error",
                            "error": summary_data.get("message"),
                            "details": summary_data.get(
                                "code", HTTPStatus.INTERNAL_SERVER_ERROR
                            ),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                    500,
                )

        # Return combined results
        response_data = {
            "status": "success",
            "edgar_data_process": process_data,
            "summary_process": summary_data,
        }

        logger.info(
            f"Successfully processed and summarized document for {data['equity_id']}"
        )
        return jsonify(response_data), 200

    except Exception as e:
        logger.exception(
            f"Unexpected error in process_and_summarize_document: {str(e)}"
        )
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "An unexpected error occurred while processing the document",
                    "details": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ),
            500,
        )
