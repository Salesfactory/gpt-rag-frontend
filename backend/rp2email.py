import os
import logging
import markdown
from pathlib import Path
from typing import Literal, List, Dict, Optional, Any

from pydantic import BaseModel, Field, EmailStr

from report_email_templates.email_templates import EmailTemplateManager
from llm_config import LLMManager
from financial_doc_processor import BlobStorageManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

TEMP_DIR = "blob_downloads"
EMAIL_ENDPOINT = '/api/reports/email'
PDF_OUTPUT_NAME = "report.pdf"

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
        """

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
        """Convert the html content to a pdf file."""
        from weasyprint import HTML
        HTML(string=html_content).write_pdf(output_path)
        return Path(output_path)

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

def send_email(
        email_data: Dict[str, Any], 
        recipients: List[str],
        attachment_path: Optional[str] = None,
        email_subject: Optional[str] = None
) -> bool:
    """Send an email to the recipients.

    Args: 
        email_data: Dictionary containing email content 
        recipients: List of recipients
        attachment_path: Path to the attachment file (local path)
        email_subject: Subject of the email

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
            "attachment_path": email_data["attachment_path"]
        }

        # overwrite the attachment path if provided
        if attachment_path:
            payload["attachment_path"] = attachment_path
        
        if attachment_path.lower() == 'no':
            payload["attachment_path"] = None
        
        if email_subject:
            payload["subject"] = email_subject
        
        # send email using the endpoint 
        with current_app.test_client() as client: 
            response = client.post(EMAIL_ENDPOINT, json=payload)

        if response.status_code == 200:
            logger.info("Email sent successfully")
            return True
        
        error_data = response.get_json()
        error_message = error_data.get('message', 'Unknown error')
        logger.error(f"Failed to send email. Status code: {response.status_code}. Error: {error_message}")
        raise EmailSendingError(error_message)  # Raise the custom exception
        
    except EmailSendingError:
        raise  # Re-raise email-specific errors
    except Exception as e:
        logger.exception(f"Error sending email: {str(e)}")
        raise EmailSendingError(f"Unexpected error while sending email: {str(e)}")
def process_and_send_email(blob_link: str, 
                         recipients: List[str],
                         attachment_path: Optional[str] = None,
                         email_subject: Optional[str] = None
                         ) -> bool:
    """
    Process the report and send the email. 
    
    Args:
        blob_link: Link to the report blob
        recipients: List of recipients

    Returns:
        bool: True if the email is sent successfully, False otherwise. 
    """
    processor = None
    success = False
    processor = ReportProcessor(blob_link)

    with processor._resource_cleanup():
        try: 
            # initialize and process report 
            email_data = processor.process()
            # send email 
            success = send_email(email_data, recipients, attachment_path, email_subject)
            return success
        
        except Exception as e:
            logger.exception(f"Error processing and sending email: {str(e)}")
            return False



# """  

# Requirements for this endpoint:
# - Blob link from the report
# - List of recipients
# - Optional: attachment path and email subject
# - email_subject: subject of the email



# What does this endpoint do?

# 1. Download the report from the blob link -> that's why we need the blob link 
# 2. Open the report and extract the content from the local path 
# 3. Summarize the report -> that's why we need to initialize the llm and the prompt 
# 4. parse the summary into the email schema -> use llm to parse 
# 5. render the email template -> use the email template manager to render the email template with jinja2
# 6. pass the formatted email to the email service endpoint 
# 7. send the email to the recipients 
# ---------------------------------------------------
# What do I need for the email service endpoint? ? 
# 1. List of recipients 
# 2. Subject of the email 
# 3. Link to the blob report content (original). Get the link where it is downloaded 
# 4. html content for the email (formatted)  
# """