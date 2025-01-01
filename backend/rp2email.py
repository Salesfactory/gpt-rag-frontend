import os
import logging
import markdown
from pathlib import Path
from typing import Literal, List, Dict

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
# Blob Manager
####################################
blob_manager = BlobStorageManager()

# todo: check if the status is success before processing this 
#! this is is retrieved from the previous successful run the process_and_summarize endpoint
blob_link = 'https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Reports/Curation_Reports/Monthly_Economics/December_2024.html?sv=2022-11-02&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2025-01-06T13:29:33Z&st=2024-09-25T04:29:33Z&spr=https&sig=rmMDVy0aPztEj6A%2FMQHFbioHbLuiL3tn622D993%2Fvow%3D'

file = blob_manager.download_blob_from_a_link(blob_link)

# get the file within blob downloads
html_file_path = next(Path(os.getcwd()).glob('blob_downloads/*.html'))

# Check if the file exists
if html_file_path.exists():
    with open(html_file_path, 'r', encoding='utf-8') as file:
        html_content = file.read()
    logger.info("Successfully imported the HTML file")
else:
    logger.error("HTML file not found")

####################################
# LLM init
####################################

llm_manager = LLMManager()
llm = llm_manager.get_client(client_type='gpt4o', use_langchain=True)
# get prompt 
sys_prompt = llm_manager.get_prompt(prompt_type='email_template')

# add the report content to the prompt 
prompt = sys_prompt.format(report_content=html_content)

# summarize the report
summary = llm.invoke(prompt)
# todo: check if the summary is successful before parsing

# conver the summary to HTMl
report_html: str = markdown.markdown(summary.content)


####################################
# Email Template Manager
####################################    

# parse the summary into an email schema
llm_report_parser = llm.with_structured_output(EmailSchema)
email_schema = llm_report_parser.invoke(summary.content)
# Todo: check if the email schema is successful



template_manager = EmailTemplateManager()
email_html_content = template_manager.render_report_template(
    title = email_schema.title, 
    intro_text = email_schema.intro_text,
    key_points = email_schema.get_keypoints_dict(),
    why_it_matters = email_schema.why_it_matters,
    document_type = email_schema.document_type
)

# write the email to a file 
with open('email_html_content.html', 'w') as file:
    file.write(email_html_content)


#todo: define payload request for this endpoint 

#todo: create flask endpoint for this 

#todo: add some logging along the process 

#todo: clean up resources after finished 

#todo: send using the endpoint 