"""
Report Scheduler Module

This module provides functionality to automatically trigger reports on a daily schedule
and log the results to Cosmos DB for tracking and auditing purposes.

Scheduling Strategy:
- Uses APScheduler with a cron-based approach
- Runs daily at 2:00 AM UTC
- Processes all configured report types

Report Discovery:
- Currently uses a static configuration of report names
- Can be extended to fetch from database or API endpoints

Logging:
- Logs execution results to Cosmos DB container 'scheduled_report_triggers'
- Includes execution metadata, response status, and error details
- Supports TTL for automatic cleanup of old logs
"""

import os
import uuid
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from shared.cosmo_db import get_cosmos_container

# Configure logging
logger = logging.getLogger(__name__)

# Static configuration of available report names
# This can be extended to fetch from database or API endpoints
AVAILABLE_REPORTS = [
    "weekly_economics",
    "monthly_economics",
    "company_analysis",
    "ecommerce",
    "home_improvement",
    "general"
]


class ReportScheduler:
    """
    Handles scheduled report triggering and logging.
    """

    def __init__(self, base_url: str = "http://localhost:5000"):
        """
        Initialize the report scheduler.

        Args:
            base_url: Base URL for the Flask API endpoints
        """
        self.base_url = base_url
        self.scheduler = BackgroundScheduler()
        self.execution_id = None

    def start(self):
        """Start the scheduler with the daily report job."""
        try:
            # Add the daily report job - runs at 2:00 AM UTC every day
            self.scheduler.add_job(
                func=self._trigger_daily_reports,
                trigger=CronTrigger(hour=2, minute=0, timezone='UTC'),
                id='daily_report_trigger',
                name='Daily Report Trigger',
                replace_existing=True
            )

            self.scheduler.start()
            logger.info(
                "Report scheduler started successfully. Daily reports will trigger at 2:00 AM UTC.")

        except Exception as e:
            logger.error(f"Failed to start report scheduler: {e}")
            raise

    def stop(self):
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Report scheduler stopped.")

    def _trigger_daily_reports(self):
        """
        Main function that triggers all available reports and logs results.
        """
        self.execution_id = str(uuid.uuid4())
        logger.info(f"Starting daily report execution: {self.execution_id}")

        # Log the start of execution
        self._log_execution_summary(
            "STARTED", "Daily report execution started")

        try:
            # Get list of available reports
            report_names = self._get_available_reports()
            logger.info(f"Found {len(report_names)} reports to process")

            # Process each report
            for report_name in report_names:
                self._process_single_report(report_name)

            # Log successful completion
            self._log_execution_summary(
                "COMPLETED", f"Successfully processed {len(report_names)} reports")
            logger.info(
                f"Daily report execution completed: {self.execution_id}")

        except Exception as e:
            error_msg = f"Failed to complete daily report execution: {str(e)}"
            logger.error(error_msg)
            self._log_execution_summary("FAILED", error_msg)

    def _get_available_reports(self) -> List[str]:
        """
        Get the list of available report names.

        Returns:
            List of report names to process
        """
        # Currently using static configuration
        # This can be extended to fetch from database or API
        return AVAILABLE_REPORTS

    def _process_single_report(self, report_name: str):
        """
        Process a single report by making a POST request and logging the result.

        Args:
            report_name: Name of the report to process
        """
        logger.info(f"Processing report: {report_name}")

        try:
            # Make POST request to trigger the report
            response = self._make_report_request(report_name)

            # Log the result
            self._log_report_result(
                report_name=report_name,
                trigger_status="SUCCESS" if response.status_code < 400 else f"HTTP_{response.status_code}",
                response_payload=response.text if response.status_code < 400 else None,
                error_message=None if response.status_code < 400 else f"HTTP {response.status_code}: {response.text}"
            )

            logger.info(f"Successfully processed report {report_name}")

        except requests.exceptions.RequestException as e:
            error_msg = f"Request failed for report {report_name}: {str(e)}"
            logger.error(error_msg)
            self._log_report_result(
                report_name=report_name,
                trigger_status="FAILURE",
                response_payload=None,
                error_message=error_msg
            )

        except Exception as e:
            error_msg = f"Unexpected error processing report {report_name}: {str(e)}"
            logger.error(error_msg)
            self._log_report_result(
                report_name=report_name,
                trigger_status="FAILURE",
                response_payload=None,
                error_message=error_msg
            )

    def _make_report_request(self, report_name: str) -> requests.Response:
        """
        Make a POST request to trigger a report.

        Args:
            report_name: Name of the report to trigger

        Returns:
            Response from the API endpoint
        """
        url = f"{self.base_url}/api/reports/{report_name}"

        # Add a console message as requested
        print(
            f"🕐 [{datetime.now(timezone.utc).isoformat()}] Triggering report: {report_name}")

        payload = {
            "report_name": report_name,
            "organization_id": "demo-tenant-3",
            "params": {
                "brand": "ACME"
            }
        }

        response = requests.post(url, timeout=30, json=payload)
        return response

    def _log_report_result(self, report_name: str, trigger_status: str,
                           response_payload: Optional[str], error_message: Optional[str]):
        """
        Log a single report result to Cosmos DB.

        Args:
            report_name: Name of the report that was processed
            trigger_status: Status of the trigger (SUCCESS, FAILURE, or HTTP status code)
            response_payload: Response payload if successful
            error_message: Error message if failed
        """
        try:
            container = get_cosmos_container("scheduled_report_triggers")

            log_entry = {
                "id": str(uuid.uuid4()),
                "execution_id": self.execution_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "report_name": report_name,
                "trigger_status": trigger_status,
                "response_payload": response_payload,
                "error_message": error_message,
                # 90 days TTL
                "ttl": int((datetime.now(timezone.utc) + timedelta(days=90)).timestamp())
            }

            container.create_item(body=log_entry)
            logger.debug(
                f"Logged result for report {report_name} with status {trigger_status}")

        except Exception as e:
            logger.error(f"Failed to log report result for {report_name}: {e}")

    def _log_execution_summary(self, status: str, message: str):
        """
        Log execution summary to Cosmos DB.

        Args:
            status: Status of the execution
            message: Summary message
        """
        try:
            container = get_cosmos_container("scheduled_report_triggers")

            summary_entry = {
                "id": str(uuid.uuid4()),
                "execution_id": self.execution_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "report_name": "EXECUTION_SUMMARY",
                "trigger_status": status,
                "response_payload": message,
                "error_message": None,
                # 90 days TTL
                "ttl": int((datetime.now(timezone.utc) + timedelta(days=90)).timestamp())
            }

            container.create_item(body=summary_entry)
            logger.debug(f"Logged execution summary with status {status}")

        except Exception as e:
            logger.error(f"Failed to log execution summary: {e}")


# Global scheduler instance
_scheduler_instance: Optional[ReportScheduler] = None


def initialize_scheduler(base_url: str = None):
    """
    Initialize and start the report scheduler.

    Args:
        base_url: Base URL for the Flask API endpoints.
    """
    global _scheduler_instance

    _scheduler_instance = ReportScheduler(base_url)
    _scheduler_instance.start()


def stop_scheduler():
    """Stop the report scheduler."""
    global _scheduler_instance

    if _scheduler_instance:
        _scheduler_instance.stop()
        _scheduler_instance = None


def get_scheduler() -> Optional[ReportScheduler]:
    """Get the current scheduler instance."""
    return _scheduler_instance
