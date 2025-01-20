#########################
# Curation Report Generator
#########################
# get the current month and year to format Month_Year.html  
from datetime import datetime
current_month = datetime.now().strftime("%B")
current_year = datetime.now().strftime("%Y")


REPORT_TOPIC_PROMPT_DICT = {
    "Ecommerce": f"Please provide an ecommerce report for {current_month} {current_year}",
    "Monthly_Economics": f"Please provide an economics report for {current_month} {current_year}",
    "Weekly_Economics": f"Please provide an economics report for this week",
    "Home_Improvement": f"Please provide a home improvement report for {current_month} {current_year}",
    "Company_Analysis": f"Please provide a company analysis report in {current_month} {current_year} for company_name"
}    


class ReportGenerationError(Exception):
    """Base exception for report generation errors"""
    pass

class InvalidReportTypeError(ReportGenerationError):
    """Raised when report type is invalid"""
    pass

class StorageError(ReportGenerationError):
    """Raised when storage operations fail"""
    pass