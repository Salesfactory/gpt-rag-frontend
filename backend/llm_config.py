# llm_config.py
from pydantic import BaseModel, Field
from typing import Dict, Optional
import json
from openai import AzureOpenAI
import os
from dotenv import load_dotenv

load_dotenv()

class LLMConfig(BaseModel):
    api_base: str = Field(default=os.getenv('OPENAI_API_BASE'))
    api_key: str = Field(default=os.getenv('OPENAI_API_KEY'))
    api_version: str = Field(default=os.getenv('OPENAI_API_VERSION'))
    model_name: str = Field(default=os.getenv('OPENAI_GPT_MODEL'))
    
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
        default="""
        You are a professional financial analyst tasked with synthesizing multiple document sections into one cohesive summary.

        Guidelines:
        - Create a flowing narrative that connects key points logically
        - Identify and emphasize the most significant themes and findings
        - Maintain chronological or logical order where appropriate
        - Avoid repetition and redundant information
        - Use transitional phrases to connect related ideas
        - Ensure consistency in terminology and tone
        - Focus on the broader picture while including crucial details
        - Write in a clear, professional style

        Your summary should read as a single, unified document rather than a collection of separate points.
        """
    )

    class Config:
        frozen = True

class LLMManager:
    def __init__(self):
        self.prompts = PromptTemplate()
        self._clients: Dict[str, AzureOpenAI] = {}
        self.config: Dict[str, LLMConfig] = {
            "gpt4o": LLMConfig(
                api_base=os.getenv('OPENAI_API_BASE'),
                api_key=os.getenv('OPENAI_API_KEY'),
                api_version=os.getenv('OPENAI_API_VERSION'),
                model_name=os.getenv('OPENAI_GPT_MODEL')
            ),
            "embedding": LLMConfig(
                api_base=os.getenv('OPENAI_API_BASE'),
                api_key=os.getenv('OPENAI_API_KEY'),
                api_version=os.getenv('OPENAI_API_VERSION'),
                model_name=os.getenv('OPENAI_EMBEDDING_MODEL')
            )
        }

    def get_client(self, client_type: str = "gpt4o") -> AzureOpenAI:
        """Get or create an Azure OpenAI client"""
        if client_type not in self._clients:
            config = self.config[client_type]
            self._clients[client_type] = AzureOpenAI(
                api_key=config.api_key,
                api_version=config.api_version,
                base_url=f"{config.api_base}/openai/deployments/{config.model_name}"
            )
        return self._clients[client_type]

    def get_prompt(self, prompt_type: str) -> str:
        """Get a prompt template by type"""
        return getattr(self.prompts, prompt_type)