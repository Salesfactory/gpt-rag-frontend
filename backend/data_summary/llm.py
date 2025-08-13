from abc import ABC, abstractmethod

class LLMClient(ABC):
    @abstractmethod
    def summarize_dataframe(self, df, prompt: str) -> str: ...

class PandasAIClient(LLMClient):
    def __init__(self, azure_endpoint: str, api_key: str, api_version: str, deployment_name: str):
        from pandasai_openai import AzureOpenAI as PandasAIAzureOpenAI
        import pandasai as pai
        self._llm = PandasAIAzureOpenAI(
            azure_endpoint=azure_endpoint,
            api_token=api_key,
            deployment_name=deployment_name,
            api_version=api_version,
        )
        pai.config.set({
            "llm": self._llm,
            "save_logs": False,
            "save_charts": False,
            "return_code": False,
            "enable_charts": False,
            "verbose": False,
        })

    def summarize_dataframe(self, df, prompt: str) -> str:
        return df.chat(prompt)