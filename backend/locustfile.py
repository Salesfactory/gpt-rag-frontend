import random
from locust import HttpUser, task, between

class WebAppUser(HttpUser):
    """
    Simulates a user's journey: creating resources and then deleting them.
    """
    wait_time = between(1, 3)

    # --- Test Data ---
    # IMPORTANT: Replace these with actual IDs and file names from your test environment.
    test_user_id = "user-uuid-to-test"
    test_organization_id = "org-uuid-to-test"
    # This file MUST exist in your blob storage for the business-describe task to succeed.
    test_file_name = "your_test_file.csv"

    auth_headers = {
        "X-MS-CLIENT-PRINCIPAL-ID": "your-test-principal-id",
        "X-MS-CLIENT-PRINCIPAL-NAME": "testuser@example.com"
    }

    def on_start(self):
        """Initializes lists to store created item IDs for each user."""
        self.created_invitation_ids = []
        # --- NEW ---
        self.created_report_job_ids = []


    # =================================================================
    # == User Management Tasks
    # =================================================================
    @task(10)
    def check_user(self):
        """Task to check/create the current authenticated user."""
        email_data = {"email": self.auth_headers["X-MS-CLIENT-PRINCIPAL-NAME"]}
        self.client.post(
            "/api/checkuser",
            json=email_data,
            headers=self.auth_headers,
            name="/api/checkuser"
        )
    
    @task(5)
    def update_user_put(self):
        """Task to fully update a user's data using PUT."""
        user_data = {
            "name": f"Updated Name {random.randint(1, 1000)}",
            "role": random.choice(["admin", "user", "guest"]),
        }
        self.client.put(
            f"/api/user/{self.test_user_id}",
            json=user_data,
            headers=self.auth_headers,
            name="/api/user/[user_id]"
        )

    # =================================================================
    # == Invitation Management Tasks (Create -> Delete)
    # =================================================================
    @task(4)
    def create_invitation_and_save_id(self):
        """Task to create an invitation and save its ID for deletion."""
        payload = {
            "invitedUserEmail": f"locust.user.{random.randint(1, 99999)}@example.com",
            "organizationId": self.test_organization_id,
            "role": "user",
            "nickname": f"Locust User {random.randint(1,100)}"
        }
        with self.client.post("/api/createInvitation", json=payload, headers=self.auth_headers, name="/api/createInvitation", catch_response=True) as response:
            if response.ok:
                try:
                    new_invitation = response.json()
                    if new_invitation and "id" in new_invitation:
                        self.created_invitation_ids.append(new_invitation["id"])
                except ValueError:
                    response.failure("Failed to parse JSON from create invitation response")

    @task(4)
    def delete_created_invitation(self):
        """Task to delete an invitation previously created by this user."""
        if self.created_invitation_ids:
            invitation_to_delete = self.created_invitation_ids.pop()
            self.client.delete(
                "/api/deleteInvitation",
                params={"invitationId": invitation_to_delete},
                headers=self.auth_headers,
                name="/api/deleteInvitation"
            )
    
    @task(6)
    def get_invitations(self):
        """Task to get invitations for an organization."""
        self.client.get(
            "/api/getInvitations",
            params={"organizationId": self.test_organization_id},
            headers=self.auth_headers,
            name="/api/getInvitations"
        )
    
    # =================================================================
    # == Report Job Management Tasks (NEW SECTION)
    # =================================================================
    @task(4)
    def create_report_job_and_save_id(self):
        """Task to create a new report job and save its ID for later actions."""
        payload = {
            "organization_id": self.test_organization_id,
            "report_name": f"Locust Brand Analysis {random.randint(1, 9999)}",
            "report_key": f"brand-analysis-{random.randint(1, 9999)}",
            "params": {"source": "locust", "trigger_time": random.random()}
        }
        with self.client.post("/api/report-jobs", json=payload, headers=self.auth_headers, name="/api/report-jobs", catch_response=True) as response:
            if response.ok:
                try:
                    new_job = response.json()
                    if new_job and "id" in new_job:
                        self.created_report_job_ids.append(new_job["id"])
                except ValueError:
                    response.failure("Failed to parse JSON from create report job response")

    @task(8)
    def list_report_jobs(self):
        """Task to list report jobs for an organization, with optional filters."""
        params = {
            "organization_id": self.test_organization_id,
            "limit": random.randint(10, 100)
        }
        # ~33% of requests will include a status filter
        if random.random() < 0.33:
            allowed_statuses = ["SUCCEEDED", "RUNNING", "QUEUED", "FAILED"]
            params["status"] = random.choice(allowed_statuses)
        
        self.client.get(
            "/api/report-jobs",
            params=params,
            headers=self.auth_headers,
            name="/api/report-jobs" # Name is kept generic for aggregation
        )

    @task(2)
    def get_created_report_job(self):
        """Task to fetch a single report job that was previously created."""
        if self.created_report_job_ids:
            job_to_get = random.choice(self.created_report_job_ids)
            self.client.get(
                f"/api/report-jobs/{job_to_get}",
                params={"organization_id": self.test_organization_id},
                headers=self.auth_headers,
                name="/api/report-jobs/[job_id]"
            )

    @task(4)
    def delete_created_report_job(self):
        """Task to delete a report job previously created by this user."""
        if self.created_report_job_ids:
            job_to_delete = self.created_report_job_ids.pop()
            self.client.delete(
                f"/api/report-jobs/{job_to_delete}",
                params={"organization_id": self.test_organization_id},
                headers=self.auth_headers,
                name="/api/report-jobs/[job_id]"
            )
