from abc import ABC, abstractmethod
from pandasai_openai import AzureOpenAI as PandasAIAzureOpenAI
from openai import OpenAI
import pandasai as pai


class LLMClient(ABC):
    @abstractmethod
    def summarize_dataframe(self, df, prompt: str) -> str: ...


class PandasAIClient(LLMClient):
    def __init__(
        self, azure_endpoint: str, api_key: str, api_version: str, deployment_name: str
    ):
        self._llm = PandasAIAzureOpenAI(
            azure_endpoint=azure_endpoint,
            api_token=api_key,
            deployment_name=deployment_name,
            api_version=api_version,
        )
        pai.config.set(
            {
                "llm": self._llm,
                "save_logs": False,
                "save_charts": False,
                "return_code": False,
                "enable_charts": False,
                "verbose": False,
            }
        )

    def summarize_dataframe(self, df, prompt: str) -> str:
        return df.chat(prompt)


class OpenAIClient:
    def __init__(self, api_key: str, model: str):
        self._llm = OpenAI(api_key=api_key)
        self._model = model

    def summarize_document(self, file_id, prompt: str) -> str:
        response = self._llm.responses.create(
            model=self._model,
            truncation="auto",
            max_output_tokens=1000,
            reasoning={"effort": "medium"},
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_file",
                            "file_id": file_id,
                        },
                        {
                            "type": "input_text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )
        print(response)
        return response.output_text

    def upload_file(self, file) -> str:
        response = self._llm.files.create(
            file=open(file, "rb"),
            purpose="user_data",
        )
        return response.id
