# llm_config.py
from pydantic import BaseModel, Field
from typing import Dict, Optional
import json
from openai import AzureOpenAI
from langchain_openai import AzureChatOpenAI
import os
from dotenv import load_dotenv
from prompts.summarization_reports.layout_template import report_structure
load_dotenv()


class LLMConfig(BaseModel):
    api_base: str = Field(default=os.getenv("AZURE_OPENAI_ENDPOINT"))
    api_key: str = Field(default=os.getenv("AZURE_OPENAI_API_KEY"))
    api_version: str = Field(default=os.getenv("AZURE_OPENAI_API_VERSION"))
    model_name: str = Field(default=os.getenv("OPENAI_GPT_MODEL"))

    def __init__(self, **data):
        super().__init__(**data)
        if not self.api_base:
            raise ValueError(
                "Environment variable 'AZURE_OPENAI_ENDPOINT' is required."
            )
        if not self.api_key:
            raise ValueError("Environment variable 'AZURE_OPENAI_API_KEY' is required.")
        if not self.api_version:
            raise ValueError(
                "Environment variable 'AZURE_OPENAI_API_VERSION' is required."
            )
        if not self.model_name:
            raise ValueError("Environment variable 'OPENAI_GPT_MODEL' is required.")

    class Config:
        frozen = True  # Makes the config immutable


class PromptTemplate(BaseModel):
    image_analysis: str = Field(
        default="""
        You are a professional document analyst tasked with creating clear, concise summaries. 

        Guidelines:
        - Focus on key information, main points, and essential details
        - Use clear, professional language
        - Maintain factual accuracy and objectivity
        - Present information directly without meta-commentary
        - Write in complete, well-structured sentences
        - Exclude phrases like "this image shows" or "I can see"
        - Make sure you capture all important financial figures
        - Limit to 4-6 impactful sentences

        Format your response as a straightforward summary without any introductory or concluding remarks.
        """
    )

    final_summary: str = Field(
        default=f"""
        You are a professional financial analyst tasked with synthesizing multiple document sections into one cohesive summary.

        Guidelines:
        - Create a flowing narrative that connects key points logically
        - Maintain chronological or logical order where appropriate
        - Ensure consistency in terminology and tone
        - Write in a clear, professional style
        - Emphasize key financial changes and figures using bold formatting.

        **IMPORTANT:**
        - Please write the final summary in a well-structured markdown format
        - Do not include any Markdown code fences (for example, ```markdown) before or after your final response.
        

        Here is the report structure for 10Q/10K reports. Please follow this stucture whenever possible:

        <------- 10Q/10K REPORT STRUCTURE -------->
        {report_structure}
        <------- END OF 10Q/10K REPORT STRUCTURE -------->
        """
    )

    email_template: str = Field(
        default="""
        Summarize the following report in to 3 main key points. 

        I want to maintain the title of the report.

        You should include an intro text with just one sentence capture the main theme of the report, and tell them here are 3 key points of the reports.

        I also want to add a part 'Why it matters' at the end.

        Be concise and to the point. No more than 2 sentences per point.

        No need to include any citations or references.

        If there is any HTML tags, please remove them.

        Here is the report:

        {report_content}
        """
    )

    class Config:
        frozen = True


class LLMManager:
    def __init__(self):
        self.prompts = PromptTemplate()
        self._clients: Dict[str, AzureOpenAI | AzureChatOpenAI] = {}
        self.config: Dict[str, LLMConfig] = {
            "gpt4o": LLMConfig(
                api_base=os.getenv("AZURE_OPENAI_ENDPOINT"),
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
                model_name=os.getenv("OPENAI_GPT_MODEL"),
            ),
            "embedding": LLMConfig(
                api_base=os.getenv("AZURE_OPENAI_ENDPOINT"),
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
                model_name=os.getenv("AZURE_OPENAI_EMBEDDING_MODEL"),
            ),
        }

    def get_client(
        self, client_type: str = "gpt4o", use_langchain: bool = False
    ) -> AzureOpenAI | AzureChatOpenAI:
        """Get or create an Azure OpenAI client

        Args:
            client_type: Type of client to create ("gpt4o" or "embedding")
            use_langchain: If True, returns a LangChain AzureChatOpenAI client instead of regular AzureOpenAI
        """
        client_key = f"{client_type}_langchain" if use_langchain else client_type

        if client_key not in self._clients:
            config = self.config[client_type]
            if use_langchain:
                self._clients[client_key] = AzureChatOpenAI(
                    openai_api_key=config.api_key,
                    openai_api_version=config.api_version,
                    azure_endpoint=config.api_base,
                    deployment_name=config.model_name,
                )
            else:
                self._clients[client_key] = AzureOpenAI(
                    api_key=config.api_key,
                    api_version=config.api_version,
                    base_url=f"{config.api_base}/openai/deployments/{config.model_name}",
                )
        return self._clients[client_key]

    def get_prompt(self, prompt_type: str) -> str:
        """Get a prompt template by type"""
        return getattr(self.prompts, prompt_type)
