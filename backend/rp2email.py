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

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

TEMP_DIR = "blob_downloads"
PDF_OUTPUT_NAME = "report.pdf"
HTML_TO_PDF_ENDPOINT = os.getenv('ORCHESTRATOR_URI') + "/api/html_to_pdf_converter"

# get function code from key vault for html 2 pdf 
html2pdf_function_code = get_azure_key_vault_secret("orchestrator-host--html2pdf")



####################################
# Pydantic Models
####################################

class KeyPoint(BaseModel):
    title: str = Field(..., description = "The title of the key point")
    content: str = Field(..., description= "Detailed content of the key point")

    def to_dict(self) -> Dict[str, str]:
        """Convert KeyPoint to dictionary format """
        return {
            "title": self.title,
            "content": self.content
        }

class EmailSchema(BaseModel):
    title: str = Field(..., description = "Title of the report")
    intro_text: str = Field(..., description = "Introductory text below the title")
    keypoints: List[KeyPoint] = Field(..., description = "3 lists of key points from the report")
    why_it_matters: str = Field(..., description = "The 'Why it matters' section")
    document_type: Literal["WeeklyEconomics", "CompanyAnalysis", "CreativeBrief", "Ecommerce", "MonthlyMacroeconomics"] = Field(..., description="The type of the document")

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
from contextlib import contextmanager
from typing import Generator
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
        from urllib.parse import urlparse
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

            # save the html content to a pdf file 
            pdf_path = self.html_to_pdf(html_content, f"{TEMP_DIR}/{PDF_OUTPUT_NAME}")

            # summarize the report 
            logger.info("Summarizing the report")
            summary = self._summarize_report(html_content)

            # parse to email schema 
            logger.info("Parsing the report to email schema")
            email_data = self._parse_report_to_email_schema(summary)

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
            import uuid
            from datetime import datetime, timezone
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
        import requests
        import json
        from pathlib import Path

        payload = json.dumps({"html": html_content})

        key_secret_name = "orchestrator-host--html2pdf"

        try:
            function_key = get_azure_key_vault_secret(key_secret_name)
        except Exception as e:
            logger.exception(f"Error getting the function key: {str(e)}")
            raise RuntimeError(f"Failed to retrieve function key: {key_secret_name}")

        headers = {
            "Content-Type": "application/json",
            "x-functions-key": function_key
        }

        try:
            logger.info("Attempting to connect to HTML to PDF converter")
            response = requests.post(
                HTML_TO_PDF_ENDPOINT, 
                headers=headers, 
                data=payload,
                timeout=30  # Add timeout
            )
            response.raise_for_status()

            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)

            with open(output_path, 'wb') as f:
                f.write(response.content)
            logger.info(f"PDF saved successfully at {output_path}")

            return Path(output_path)

        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error to HTML to PDF converter: {str(e)}")
            raise RuntimeError(
                f"Failed to connect to HTML to PDF converter at {HTML_TO_PDF_ENDPOINT}. "
                "Please ensure the Azure Function is running and accessible."
            )
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error occurred: {e.response.text if e.response else str(e)}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error occurred: {str(e)}")
            raise
        except IOError as e:
            logger.error(f"Error saving PDF file: {str(e)}")
            raise

    def cleanup(self) -> None:
        """Clean up temporary files. """
        try: 
            if isinstance(self.downloaded_file, Path) and self.downloaded_file.exists():
                self.downloaded_file.unlink(missing_ok=True)
                logger.info("Cleaned up downloaded file")
            
            # clean up the blob downloads directory
            blob_downloads = Path(os.getcwd()) / f'{TEMP_DIR}'
            if blob_downloads.exists():
                import shutil
                shutil.rmtree(blob_downloads)
                logger.info("Cleaned up blob downloads directory")

        except Exception as e:
            logger.exception(f"Error cleaning up resources: {str(e)}")


####################################
# Send Email
####################################
from flask import current_app
from datetime import datetime, timezone
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
                         save_email: Optional[str] = "yes"
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
            email_data = processor.process()
            success = send_email(email_data, recipients, attachment_path, email_subject, save_email)
            return success
        
    except ValueError as e:
        logger.error(f"Invalid input: {str(e)}")
        return False
    except Exception as e:
        logger.exception(f"Error processing and sending email: {str(e)}")
        return False


