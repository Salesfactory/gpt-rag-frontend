from typing import List, Dict, Literal
from pathlib import Path
import jinja2 

class EmailTemplateManager:
    """Manages email template rendering. """

    def __init__(self):
        template_dir = Path(__file__).parent / 'html'
        self.env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(template_dir)),
            autoescape = jinja2.select_autoescape(['html', 'xml'])
        )
    def render_report_template(
        self,
        title: str, 
        intro_text: str, 
        key_points: List[Dict[str, str]],
        why_it_matters: str,
        document_type: Literal["WeeklyEconomics", "CompanyAnalysis", "CreativeBrief", "Ecommerce", "MonthlyMacroeconomics"]
    ) -> str:
        
        """
        Render the report email template with provided content.
        
        Args:
            title: Main title of the report
            intro_text: Introductory text
            key_points: List of dictionaries containing 'title' and 'content'
            why_it_matters: Why this information matters section
            document_type: Type of document for the chat link
        
        Returns:
            str: Rendered HTML content
        """

        template = self.env.get_template('report_email.html')
        return template.render(
            title=title,
            intro_text=intro_text,
            key_points=key_points,
            why_it_matters=why_it_matters,
            document_type=document_type
        )
