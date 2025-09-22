from flask import Blueprint, jsonify, request
from werkzeug.exceptions import NotFound
from routes.decorators.auth_decorator import auth_required
from shared.cosmo_db import get_report, create_report, update_report, delete_report, get_filtered_reports
import logging

bp = Blueprint("reports", __name__, url_prefix="/api/reports")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)



@bp.route("/api/reports", methods=["GET"])
@auth_required
def getFilteredType():
    """
    Endpoint to obtain reports by type or retrieve all reports if no type is specified.
    """
    report_type = request.args.get("type")

    try:
        if report_type:
            reports = get_filtered_reports(report_type)
        else:
            reports = get_filtered_reports()

        return jsonify(reports), 200

    except NotFound as e:
        logging.warning(f"No reports found for type '{report_type}'.")
        return jsonify({"error": f"No reports found for type '{report_type}'."}), 404

    except Exception as e:
        logging.exception(f"Error retrieving reports.")
        return jsonify({"error": "Internal Server Error"}), 500



# get report by id argument from Container Reports
@bp.route("/<report_id>", methods=["GET"])
@auth_required
def getReport(report_id):
    """
    Endpoint to get a report by ID.
    """
    try:
        report = get_report(report_id)
        return jsonify(report), 200
    except NotFound as e:
        logging.warning(f"Report with id {report_id} not found.")
        return jsonify({"error": f"Report with this id {report_id} not found"}), 404
    except Exception as e:
        logging.exception(
            f"An error occurred retrieving the report with id {report_id}"
        )
        return jsonify({"error": "Internal Server Error"}), 500


# create Reports curation and companySummarization container Reports
@bp.route("/", methods=["POST"])
@auth_required
def createReport():
    """
    Endpoint to create a new report.
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        # Validate the 'name' field
        if "name" not in data:
            return jsonify({"error": "Field 'name' is required"}), 400

        # Validate the 'type' field
        if "type" not in data:
            return jsonify({"error": "Field 'type' is required"}), 400

        if data["type"] not in ["curation", "companySummarization"]:
            return (
                jsonify(
                    {
                        "error": "Invalid 'type'. Must be 'curation' or 'companySummarization'"
                    }
                ),
                400,
            )

        # Validate fields according to type
        if data["type"] == "companySummarization":
            required_fields = ["reportTemplate", "companyTickers"]
            missing_fields = [field for field in required_fields if field not in data]

            if missing_fields:
                return (
                    jsonify(
                        {
                            "error": f"Missing required fields: {', '.join(missing_fields)}"
                        }
                    ),
                    400,
                )

            # Validate 'reportTemplate'
            valid_templates = ["10-K", "10-Q", "8-K", "DEF 14A"]
            if data["reportTemplate"] not in valid_templates:
                return (
                    jsonify(
                        {
                            "error": f"'reportTemplate' must be one of: {', '.join(valid_templates)}"
                        }
                    ),
                    400,
                )

        elif data["type"] == "curation":
            required_fields = ["category"]
            missing_fields = [field for field in required_fields if field not in data]

            if missing_fields:
                return (
                    jsonify(
                        {
                            "error": f"Missing required fields: {', '.join(missing_fields)}"
                        }
                    ),
                    400,
                )

            # Validate 'category'
            valid_categories = ["Ecommerce", "Weekly Economic", "Monthly Economic"]
            if data["category"] not in valid_categories:
                return (
                    jsonify(
                        {
                            "error": f"'category' must be one of: {', '.join(valid_categories)}"
                        }
                    ),
                    400,
                )

        # Validar the 'status' field
        if "status" not in data:
            return jsonify({"error": "Field 'status' is required"}), 400

        valid_statuses = ["active", "archived"]
        if data["status"] not in valid_statuses:
            return (
                jsonify(
                    {"error": f"'status' must be one of: {', '.join(valid_statuses)}"}
                ),
                400,
            )

        # Delegate report creation
        new_report = create_report(data)
        return jsonify(new_report), 201

    except Exception as e:
        logging.exception("Error creating report")
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            500,
        )


# update Reports curation and companySummarization container Reports
@bp.route("/<report_id>", methods=["PUT"])
@auth_required
def updateReport(report_id):
    """
    Endpoint to update a report by ID.
    """
    try:
        updated_data = request.get_json()

        if updated_data is None:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        updated_report = update_report(report_id, updated_data)
        return "", 204

    except NotFound as e:
        logging.warning(f"Tried to update a report that doesn't exist: {report_id}")
        return (
            jsonify(
                {
                    "error": f"Tried to update a report with this id {report_id} that does not exist"
                }
            ),
            404,
        )

    except Exception as e:
        logging.exception(
            f"Error updating report with ID {report_id}"
        )  # Logs the full exception
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            500,
        )


# delete report from Container Reports
@bp.route("/<report_id>", methods=["DELETE"])
@auth_required
def deleteReport(report_id):
    """
    Endpoint to delete a report by ID.
    """
    try:
        delete_report(report_id)

        return "", 204

    except NotFound as e:
        # If the report does not exist, return 404 Not Found
        logging.warning(f"Report with id {report_id} not found.")
        return jsonify({"error": f"Report with id {report_id} not found."}), 404

    except Exception as e:
        logging.exception(f"Error deleting report with id {report_id}")
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            500,
        )
