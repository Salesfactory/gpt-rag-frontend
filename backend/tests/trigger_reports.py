#!/usr/bin/env python3
"""
Manual Report Trigger Script

This script allows you to manually trigger reports for testing purposes.
It bypasses the scheduler and directly processes reports.
"""

import sys
import time
from datetime import datetime, timezone
from report_scheduler import ReportScheduler

def trigger_single_report(report_name: str, base_url: str = "http://localhost:5000"):
    """Trigger a single report manually."""
    print(f"🚀 Triggering report: {report_name}")
    print(f"⏰ Time: {datetime.now(timezone.utc).isoformat()}")
    print("-" * 50)
    
    scheduler = ReportScheduler(base_url=base_url)
    scheduler._process_single_report(report_name)
    
    print("-" * 50)
    print("✅ Report trigger completed!")

def trigger_all_reports(base_url: str = "http://localhost:5000"):
    """Trigger all available reports manually."""
    print("🚀 Triggering all available reports")
    print(f"⏰ Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)
    
    scheduler = ReportScheduler(base_url=base_url)
    
    # Get available reports
    reports = scheduler._get_available_reports()
    print(f"📋 Found {len(reports)} reports to process:")
    for i, report in enumerate(reports, 1):
        print(f"  {i}. {report}")
    
    print("\n" + "=" * 60)
    
    # Process each report
    for i, report_name in enumerate(reports, 1):
        print(f"\n📊 Processing report {i}/{len(reports)}: {report_name}")
        print("-" * 40)
        
        try:
            scheduler._process_single_report(report_name)
            print("✅ Success")
        except Exception as e:
            print(f"❌ Failed: {e}")
        
        # Small delay between reports
        if i < len(reports):
            time.sleep(1)
    
    print("\n" + "=" * 60)
    print("🎉 All reports processed!")

def main():
    """Main function."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python trigger_reports.py all                    # Trigger all reports")
        print("  python trigger_reports.py <report_name>          # Trigger specific report")
        print("  python trigger_reports.py <report_name> <url>    # Trigger with custom URL")
        print("\nAvailable reports:")
        
        scheduler = ReportScheduler()
        reports = scheduler._get_available_reports()
        for report in reports:
            print(f"  - {report}")
        
        return
    
    command = sys.argv[1].lower()
    
    if command == "all":
        base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:5000"
        trigger_all_reports(base_url)
    else:
        # Single report
        report_name = command
        base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:5000"
        trigger_single_report(report_name, base_url)

if __name__ == "__main__":
    main()
