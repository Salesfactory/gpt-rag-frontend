from locust import HttpUser, task, between

class LoadingTestSuite(HttpUser):
    wait_time = between(1,5)

    