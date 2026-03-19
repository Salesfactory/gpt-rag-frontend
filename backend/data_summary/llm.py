from abc import ABC, abstractmethod
from pandasai_openai import OpenAI as PandasAIOpenAI
from openai import OpenAI
import pandasai as pai


class LLMClient(ABC):
    @abstractmethod
    def summarize_dataframe(self, df, prompt: str) -> str: ...


class PandasAIClient(LLMClient):
    def __init__(
            self, api_key: str, model: str
        ):
        self._llm = PandasAIOpenAI(
            api_token=api_key,
            model=model
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
            max_output_tokens=100,
            reasoning={"effort": "medium"},
            input=[
                {
                    "role": "system",
                    "content": prompt,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_file",
                            "file_id": file_id,
                        },
                        {
                            "type": "input_text",
                            "text": "Summarize this document. Using the Internal Instructions",
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
