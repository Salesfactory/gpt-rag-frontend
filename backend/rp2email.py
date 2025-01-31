import os
import logging
import markdown
from pathlib import Path
from typing import Literal, List, Dict, Optional, Any
from pydantic import BaseModel, Field, EmailStr
from report_email_templates.email_templates import EmailTemplateManager
from llm_config import LLMManager
from financial_doc_processor import BlobStorageManager
from utils import EmailService, get_azure_key_vault_secret
from dotenv import load_dotenv
import requests
import json
from pathlib import Path
from contextlib import contextmanager
from typing import Generator
from urllib.parse import unquote
from urllib.parse import urlparse
import uuid
from flask import current_app
from datetime import datetime, timezone
import shutil

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

TEMP_DIR = "blob_downloads"
# PDF_OUTPUT_NAME = "report.pdf"
HTML_TO_PDF_ENDPOINT = os.getenv('ORCHESTRATOR_URI') + "/api/html_to_pdf_converter"

# get function code from key vault for html 2 pdf 
html2pdf_function_code = get_azure_key_vault_secret("orchestrator-host--html2pdf")



####################################
# Pydantic Models
####################################

class KeyPoint(BaseModel):
    title: str = Field(..., description = "The title of the key point")
    content: str = Field(..., description= "Detailed content of the important, insightful, interesting key point. Should be a very intriguing hook to get the reader to read the rest of the report")

    def to_dict(self) -> Dict[str, str]:
        """Convert KeyPoint to dictionary format """
        return {
            "title": self.title,
            "content": self.content
        }

class EmailBaseSchema(BaseModel):
    title: str = Field(..., description = "Title of the report")
    intro_text: str = Field(..., description = "Introductory text below the title")
class EmailSchema(EmailBaseSchema):
    keypoints: List[KeyPoint] = Field(..., description = "3 lists of important, insightful, statistical key points from the report")
    why_it_matters: str = Field(..., description = "The 'Why it matters' section. This should target business owner, investor, and analyst")
    document_type: Literal["WeeklyEconomics", "CompanyAnalysis", "CreativeBrief", "Ecommerce", "MonthlyMacroeconomics", "HomeImprovement"] = Field(..., description="The type of the document")

    def get_keypoints_dict(self)  -> List[Dict[str, str]]:
        """Convert keypoints to dictionary format """
        return [point.to_dict() for point in self.keypoints]


class UserEmailPayload(BaseModel):
    email_blob_link: str = Field(..., description="The blob link to the email html file")
    recipients: List[EmailStr] = Field(..., description="The list of recipients")
    subject: str = Field(..., description="The subject of the email")
    attachment_path: Optional[str] = Field(..., description="The attachment path")

class AdminEmailPayload(BaseModel):
    report_blob_link: str = Field(..., description= "The blob link to the report html file")
    admin_recipients: List[EmailStr] = Field(..., description="The list of admin recipients")
    subject: str = Field(..., description = "The subject of the email")
    attachment_path: Optional[str] = Field(..., description = " Any attachment to be attached to the email")
####################################
# Custom Exceptions
####################################

class BlobServiceError(Exception):
    """Base exception for blob service operations"""
    pass

class BlobDownloadError(BlobServiceError):
    """Failed to download blob from URL"""
    pass

class BlobUploadError(BlobServiceError):
    """Failed to upload blob to blob storage"""
    pass

class BlobFileNotFoundError(BlobServiceError):
    """Blob file not found in downloads directory"""
    pass

class ReportProcessingError(Exception):
    """Error processing the report"""
    pass

class EmailSendingError(Exception):
    """Error sending the email"""
    pass


####################################
# Report Processor
####################################

class ReportProcessor:
    """Process reports and conver them to email format. """

    def __init__(self, blob_link: str):
        """
        Initialize report processor. 
        
        Args:
            blob_link (str): Link to the report blob        
        
        Raises:
            ValueError: If blob_link is None or empty
        """
        if not blob_link:
            raise ValueError("Blob link cannot be None or empty")
        
        # Validate URL format
        parsed_url = urlparse(blob_link)
        if not all([parsed_url.scheme, parsed_url.netloc]):
            raise ValueError(f"Invalid blob link format: {blob_link}. URL must include scheme (e.g., https://) and hostname")

        self.blob_link = blob_link
        self.blob_manager = BlobStorageManager()
        self.llm_manager = LLMManager()
        self.template_manager = EmailTemplateManager()
        self.downloaded_file: Optional[Path] = None

    @contextmanager
    def _resource_cleanup(self) -> Generator[None, None, None]:
        """Context manager to clean up resources after processing."""
        try:
            yield 
        finally:
            self.cleanup()

    def process(self) -> Dict[str, Any]:
        """
        Process a report from blob storage into an email-friendly format.
        
        This method performs several steps:
        1. Downloads and reads the HTML report content from blob storage
        2. Converts the HTML content to a PDF file
        3. Generates a summary of the report using LLM
        4. Parses the summary into a structured email schema
        5. Renders the email content using an HTML template
        
        Returns:
            Dict[str, Any]: A dictionary containing:
                - subject (str): The email subject line derived from the report title
                - html_content (str): The rendered HTML email body
                - document_type (str): The type of document/report
                - attachment_path (str): Local filesystem path to the PDF version
        
        Raises:
            ReportProcessingError: If any step in the processing pipeline fails
            BlobServiceError: If downloading the report from blob storage fails
            FileNotFoundError: If the downloaded report file cannot be found
        """
        try:
            # download and read report 
            logger.info("Downloading report from blob link")
            html_content = self._get_report_content()

            # Initialize pdf_path at the start of the method
            pdf_path = None
            
            # summarize the report 
            logger.info("Summarizing the report")
            summary = self._summarize_report(html_content)

            # parse to email schema 
            logger.info("Parsing the report to email schema")
            email_data = self._parse_report_to_email_schema(summary)

            # save the html content to a pdf file 
            date_str = datetime.now(timezone.utc).strftime("%m_%d_%y")
            document_type = email_data.document_type
            logger.info(f"Document type: {document_type}")

            # Extract company name only for Company Analysis
            company_name = None
            if "Company_Analysis" in self.blob_link:
                try:
                    path_parts = unquote(self.blob_link.split('?')[0]).split('/')
                    if len(path_parts) < 2:
                        raise ValueError("Blob link path is too short to extract company name")
                    company_name = path_parts[-2].replace('%20', '_')
                    logger.info(f"Company name: {company_name}")
                except Exception as e:
                    logger.error(f"Failed to extract company name from blob link: {self.blob_link}")
                    raise ValueError(f"Invalid blob link format: {str(e)}")

            # Create PDF for all document types
            try:
                local_pdf_path = self._build_pdf_filename(document_type, date_str, company_name)
                logger.info(f"Local PDF path: {local_pdf_path}")
                pdf_path = self.html_to_pdf(html_content, local_pdf_path)
                if not pdf_path:
                    raise ValueError("PDF creation failed - no path returned")
            except Exception as e:
                logger.error(f"Failed to create PDF: {str(e)}")
                raise ValueError(f"PDF creation failed: {str(e)}")

            # generate HTML email from schema and template 
            logger.info("Generating HTML email content")
            email_html = self.template_manager.render_report_template(
                title=email_data.title,
                intro_text=email_data.intro_text,
                key_points=email_data.get_keypoints_dict(),
                why_it_matters=email_data.why_it_matters,
                document_type=email_data.document_type
            )

            return {
                "subject": email_data.title,
                "html_content": email_html,
                "document_type": email_data.document_type,
                "attachment_path": str(pdf_path)
            }

        except Exception as e:
            logger.exception("Error processing the report")
            raise ReportProcessingError(f"Error processing the report: {str(e)}")
        
    def process_summary(self) -> Dict[str, Any]:
        """
        Process a report summary from blob storage into an email-friendly format.
        
        This method performs several steps:
        ....

        Returns:
            Dict[str, Any]: A dictionary containing:
                - subject (str): The email subject line derived from the report title
                - html_content (str): The rendered HTML email body
                - document_type (str): The type of document/report
                - attachment_path (str): Local filesystem path to the PDF version
        
        Raises:
            ReportProcessingError: If any step in the processing pipeline fails
            BlobServiceError: If downloading the report from blob storage fails
            FileNotFoundError: If the downloaded report file cannot be found
        """
        try:
            # download and read report 
            logger.info("Downloading report from blob link")
            pdf_path = self._get_pdf_path()

            # parse to email schema 
            email_data = EmailBaseSchema(
                title="Summarization",
                intro_text="Here is a summary of the report",
            )

            # generate HTML email from schema and template 
            logger.info("Generating HTML email content")
            email_html = self.template_manager.render_summary_template(
                title=email_data.title,
                intro_text=email_data.intro_text,
            )

            return {
                "subject": email_data.title,
                "html_content": email_html,
                "attachment_path": str(pdf_path)
            }

        except Exception as e:
            logger.exception("Error processing the report")
            raise ReportProcessingError(f"Error processing the report: {str(e)}")
        
    def _build_pdf_filename(self, document_type: str, date_str: str, company_name: Optional[str] = None) -> str:
        """Helper function to build PDF filename based on document type and metadata
        
        Args:
            document_type: Type of the document
            date_str: Date string for the filename
            company_name: Optional company name for company analysis reports
            
        Returns:
            str: The constructed PDF filename
            
        Raises:
            ValueError: If required parameters are invalid or if filename contains invalid characters
        """
        try:
            # Validate inputs
            if not document_type or not date_str:
                raise ValueError("document_type and date_str are required")

            # Clean company name if present (remove invalid filename characters)
            if company_name:
                # Replace invalid filename characters with underscores
                company_name = ''.join(c if c.isalnum() or c in '-_' else '_' for c in company_name)
                return f"{TEMP_DIR}/{company_name}_Company_Analysis_{date_str}.pdf"
            
            return f"{TEMP_DIR}/{document_type}_{date_str}.pdf"
            
        except Exception as e:
            logger.error(f"Error building PDF filename: {str(e)}")
            
            # Fallback to a safe default filename using UUID
            safe_filename = f"{TEMP_DIR}/report_{uuid.uuid4()}_{date_str}.pdf"
            logger.info(f"Using safe fallback filename: {safe_filename}")
            return safe_filename
    
    def _get_report_content(self) -> str:
        """Download and read the report content from the blob link. """
        try:
            # download blob from link 
            self.downloaded_file = self.blob_manager.download_blob_from_a_link(self.blob_link)

            # get the file within blob downloads
            html_file_path = next(Path(os.getcwd()).glob(f'{TEMP_DIR}/*.html'))

            # read content 
            if html_file_path.exists():
                with open(html_file_path, 'r', encoding='utf-8') as file:
                    html_content = file.read()
                    logger.info("Successfully imported the HTML file")
                    return html_content
            else:
                raise FileNotFoundError(f"HTML file not found: {html_file_path}")
        
        except Exception as e:
            logger.exception(f"Error downloading and reading the report: {str(e)}")
            raise 

    def _get_pdf_path(self) -> str:
        """Download and read the report content from the blob link. """
        try:
            # download blob from link 
            self.downloaded_file = self.blob_manager.download_blob_from_a_link(self.blob_link)

            # get the pdf file within blob downloads
            pdf_file_path = next(Path(os.getcwd()).glob(f'{TEMP_DIR}/*.pdf'))

            if pdf_file_path.exists():
                return pdf_file_path
            else:
                raise FileNotFoundError(f"PDF file not found: {pdf_file_path}")
        except Exception as e:
            logger.exception(f"Error downloading and reading the report: {str(e)}")
            raise 

    def _summarize_report(self, html_content: str) -> str:
        """Summarize the report using the LLM. """
        try: 
            llm = self.llm_manager.get_client(
                client_type='gpt4o',
                use_langchain=True
            )
            sys_prompt = self.llm_manager.get_prompt(prompt_type='email_template')
            
            prompt = sys_prompt.format(report_content=html_content)

            # summarize the report 
            summary = llm.invoke(prompt)

            if not summary.content:
                raise ReportProcessingError("Failed to generate summary")
            
            return summary.content
        
        except Exception as e:
            logger.exception(f"Error summarizing the report: {str(e)}")
            raise 

    def _upload_email_to_blob(self, email_html: str) -> str:
        """Upload the email html to the blob storage."""
        temp_dir = Path('temp_emails')
        temp_file = None
        
        try:
            # Generate a unique ID for the email
            email_id = str(uuid.uuid4())
            
            # Create a temporary file with the email content
            temp_dir.mkdir(exist_ok=True)
            temp_file = temp_dir / f"{email_id}.html"
            
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(email_html)
            
            # Upload to blob storage
            result = self.blob_manager.upload_to_blob(
                file_path=str(temp_file),
                blob_folder='FA_emails',
                metadata={
                    'email_id': email_id,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
            )
            
            if result['status'] == 'success':
                return result['blob_url']
            else:
                raise BlobUploadError(f"Failed to upload email: {result.get('error')}")
                
        except Exception as e:
            logger.exception(f"Error uploading email to blob: {str(e)}")
            raise
            
        finally:
            # Clean up resources regardless of success or failure
            if temp_file and temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception:
                    logger.warning(f"Failed to delete temporary file: {temp_file}")
                    
            if temp_dir.exists():
                try:
                    temp_dir.rmdir()
                except Exception:
                    logger.warning(f"Failed to remove temporary directory: {temp_dir}")
        

    def _parse_report_to_email_schema(self, summary: str) -> EmailSchema:
        """Parse the report summary into the email schema. """
        try:
            llm = self.llm_manager.get_client(
                client_type='gpt4o',
                use_langchain=True
            )
            llm_report_parser = llm.with_structured_output(EmailSchema)
            return llm_report_parser.invoke(summary)
        
        except Exception as e:
            logger.exception(f"Error parsing the report to email schema: {str(e)}")
            raise 
    
    def html_to_pdf(self, html_content: str, output_path: str) -> Path:
        """Convert the HTML content to a PDF file using the Azure function."""
        # Debug logging
        logger.info(f"HTML_TO_PDF_ENDPOINT: {HTML_TO_PDF_ENDPOINT}")
        content_size = len(html_content.encode('utf-8'))
        logger.info(f"HTML content size: {content_size / 1024:.2f} KB")

        try:
            # Validate endpoint
            if not HTML_TO_PDF_ENDPOINT:
                raise ValueError("HTML_TO_PDF_ENDPOINT is not set")

            # Get function key with error handling
            try:
                function_key = get_azure_key_vault_secret("orchestrator-host--html2pdf")
                if not function_key:
                    raise ValueError("Empty function key retrieved from key vault")
            except Exception as e:
                logger.error(f"Failed to get function key: {str(e)}")
                raise

            headers = {
                "Content-Type": "application/json",
                "x-functions-key": function_key
            }

            # Log request details (excluding sensitive data)
            logger.info(f"Making request to converter with headers: {{'Content-Type': {headers['Content-Type']}}}")
            
            # Make the request with better error handling
            try:
                response = requests.post(
                    HTML_TO_PDF_ENDPOINT, 
                    headers=headers, 
                    json={"html": html_content},  # Use json parameter instead of manually dumping
                    timeout=30
                )
                
                # Detailed error logging
                if response.status_code != 200:
                    logger.error(f"Conversion failed with status code: {response.status_code}")
                    logger.error(f"Response headers: {dict(response.headers)}")
                    logger.error(f"Response content: {response.text[:500]}...")  # Log first 500 chars of response
                    
                    # More specific error messages based on status code
                    if response.status_code == 400:
                        logger.error("Bad request - Check if HTML content is valid")
                    elif response.status_code == 401:
                        logger.error("Unauthorized - Check function key")
                    elif response.status_code == 413:
                        logger.error("Content too large - Check size limits")
                    
                    response.raise_for_status()

                # Process successful response
                output_dir = Path(output_path).parent
                output_dir.mkdir(parents=True, exist_ok=True)

                with open(output_path, 'wb') as f:
                    f.write(response.content)
                logger.info(f"PDF saved successfully at {output_path}")

                return Path(output_path)

            except requests.exceptions.Timeout:
                logger.error("Request timed out after 30 seconds")
                raise RuntimeError("PDF conversion timed out")
            except requests.exceptions.ConnectionError as e:
                logger.error(f"Connection failed: {str(e)}")
                raise RuntimeError(f"Cannot connect to {HTML_TO_PDF_ENDPOINT}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Request failed: {str(e)}")
                raise

        except Exception as e:
            logger.exception("PDF conversion failed")
            raise RuntimeError(f"PDF conversion failed: {str(e)}")

    def cleanup(self) -> None:
        """Clean up temporary files. """
        try: 
            if isinstance(self.downloaded_file, Path) and self.downloaded_file.exists():
                self.downloaded_file.unlink(missing_ok=True)
                logger.info("Cleaned up downloaded file")
            
            # clean up the blob downloads directory
            blob_downloads = Path(os.getcwd()) / f'{TEMP_DIR}'
            if blob_downloads.exists():
                shutil.rmtree(blob_downloads)
                logger.info("Cleaned up blob downloads directory")

        except Exception as e:
            logger.exception(f"Error cleaning up resources: {str(e)}")


####################################
# Send Email
####################################

def send_email(
        email_data: Dict[str, Any], 
        recipients: List[str],
        attachment_path: Optional[str] = None,
        email_subject: Optional[str] = None,
        save_email: Optional[str] = "yes"
) -> bool:
    """Send an email to the recipients

    Args: 
        email_data: Dictionary containing email content 
        recipients: List of recipients
        attachment_path: Path to the attachment file (local path)
        email_subject: Subject of the email
        save_email: Whether to save the email to blob storage

    Returns:
        bool: True if the email is sent successfully, False otherwise. 
    """

    # todo: allow attachment to be a blob link 
    # validate input 
    if not recipients:
        raise ValueError("Recipients list is empty")
    if not all(isinstance(r, str) and '@' in r for r in recipients):
        raise ValueError("Recipients list contains invalid email addresses")
    
    try: 
        # prepare email payload
        payload = {
            "subject": email_data["subject"],
            "html_content": email_data["html_content"],
            "recipients": recipients,
            "attachment_path": email_data["attachment_path"],
            "save_email": save_email
        }

        if attachment_path:
            payload["attachment_path"] = attachment_path

            # if attachment path is 'no', set it to None
            if attachment_path.lower() == 'no':
                payload["attachment_path"] = None
            else:
                payload["attachment_path"] = str(attachment_path)

        if email_subject:
            payload["subject"] = email_subject

        logger.info(f"Payload: {payload}")

        email_config = {
            "smtp_server": os.getenv("EMAIL_HOST"),
            "smtp_port": os.getenv("EMAIL_PORT"),
            "username": os.getenv("EMAIL_USER"),
            "password": os.getenv("EMAIL_PASS"),
        }

        email_service = EmailService(**email_config)

        email_params = {
            "subject": payload["subject"],
            "html_content": payload["html_content"],
            "recipients": payload["recipients"],
            "attachment_path": payload.get("attachment_path"),
        }

        # send the email
        email_service.send_email(**email_params)

        logger.info(f"Email sent successfully at {datetime.now(timezone.utc)}")
        logger.info(f"Recipients: {recipients}")
        return True
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error while sending email: {str(e)}"
        logger.error(error_msg)
        raise EmailSendingError(error_msg)
    except Exception as e:
        error_msg = f"Unexpected error while sending email: {str(e)}"
        logger.error(error_msg)
        raise EmailSendingError(error_msg)
    
def process_and_send_email(blob_link: str, 
                         recipients: List[str],
                         attachment_path: Optional[str] = None,
                         email_subject: Optional[str] = None,
                         save_email: Optional[str] = "yes",
                         is_summarization: Optional[bool] = False,
                         ) -> bool:
    """
    Process the report and send the email. 
    
    Args:
        blob_link: Link to the report blob
        recipients: List of recipients

    Returns:
        bool: True if the email is sent successfully, False otherwise. 
    """
    try:
        if not blob_link:
            raise ValueError("Blob link cannot be None or empty")
            
        processor = ReportProcessor(blob_link)
        with processor._resource_cleanup():
            if not is_summarization:
                email_data = processor.process()
            elif is_summarization:
                email_data = processor.process_summary() 
            success = send_email(email_data, recipients, attachment_path, email_subject, save_email)
            return success
        
    except ValueError as e:
        logger.error(f"Invalid input: {str(e)}")
        return False
    except Exception as e:
        logger.exception(f"Error processing and sending email: {str(e)}")
        return False


