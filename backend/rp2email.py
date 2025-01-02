import os
import logging
import markdown
from pathlib import Path
from typing import Literal, List, Dict, Optional, Any

from pydantic import BaseModel, Field

from report_email_templates.email_templates import EmailTemplateManager
from llm_config import LLMManager
from financial_doc_processor import BlobStorageManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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



####################################
# Custom Exceptions
####################################

class BlobServiceError(Exception):
    """Base exception for blob service operations"""
    pass

class BlobDownloadError(BlobServiceError):
    """Failed to download blob from URL"""
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

    def process(self)  -> Dict[str, Any]:
        """
        Process the report and return the email content. 
        
        Returns:
            Dict[str, Any]: Dictionary containing the email content and metadata. 
        """

        with self._resource_cleanup():

            try:
                # download and read report 
                logger.info("Downloading report from blob link")
                html_content = self._get_report_content()

                # summarize the report 
                logger.info("Summarizing the report")
                summary = self._summarize_report(html_content)

                # parse to email schema 
                logger.info("Parsing the report to email schema")
                email_data = self._parse_report_to_email_schema(summary)

                # generate HTML email from schema and template 
                logger.info("Generating HTMl email content")
                email_html = self.template_manager.render_report_template(
                    title = email_data.title,
                    intro_text = email_data.intro_text,
                    key_points = email_data.get_keypoints_dict(),
                    why_it_matters = email_data.why_it_matters,
                    document_type = email_data.document_type
                )

                return {
                    "subject": email_data.title,
                    "html_content": email_html,
                    "document_type": email_data.document_type
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
            html_file_path = next(Path(os.getcwd()).glob('blob_downloads/*.html'))

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
    
    def cleanup(self):
        """Clean up temporary files. """
        try: 
            if isinstance(self.downloaded_file, Path) and self.downloaded_file.exists():
                self.downloaded_file.unlink(missing_ok=True)
                logger.info("Cleaned up downloaded file")
            
            blob_downloads = Path(os.getcwd()) / 'blob_downloads'
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
        attachment_path: Path to the attachment file
        email_subject: Subject of the email

    Returns:
        bool: True if the email is sent successfully, False otherwise. 
    """
    
    try: 
        # prepare email payload
        payload = {
            "subject": email_data["subject"],
            "html_content": email_data["html_content"],
            "recipients": recipients,
        }

        # add optional fields if provided
        if attachment_path:
            payload["attachment_path"] = attachment_path
        
        if email_subject:
            payload["subject"] = email_subject
        
        # send email using the endpoint 
        with current_app.test_client() as client: 
            response = client.post('/api/reports/email', json=payload)

        if response.status_code == 200:
            logger.info("Email sent successfully")
            return True
        
        error_data = response.get_json()
        logger.error(f"Failed to send email. {error_data.get('message', 'Unknown error')}")
        return False
    
    except Exception as e:
        logger.exception(f"Error sending email: {str(e)}")
        return False
    
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

    try: 
        # initialize and process report 
        processor = ReportProcessor(blob_link)
        email_data = processor.process()

        # send email 
        return send_email(email_data, recipients, attachment_path, email_subject)
    
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

    


