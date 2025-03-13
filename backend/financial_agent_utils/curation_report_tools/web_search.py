from typing import Literal, Optional, List
import requests
from pydantic import BaseModel, HttpUrl
import logging
from pathlib import Path
from pydantic_settings import BaseSettings
import os
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# search default setting
class SearchSettings(BaseSettings):
    SEARCH_API_ENDPOINT: HttpUrl = os.getenv("INVITATION_LINK") + "/api/web-search"
    class Config:
        env_prefix = "SEARCH_"  # Allow override with env vars like SEARCH_MAX_RESULTS

search_settings = SearchSettings()

class SearchResult(BaseModel):
    title: str
    date: Optional[str]  # date is optional because it is not always available
    url: str
    content: str

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]

class CustomSearchClient:
    """Client for performing web searches using a custom search endpoint.
    
    Attributes:
        endpoint (str): The search API endpoint
    """

    def __init__(self, endpoint: str = search_settings.SEARCH_API_ENDPOINT):
        self.endpoint = endpoint

    def search(self, 
               query: str, 
               max_results: int = 2,
               search_days: int = 15,
               search_mode: Literal["news", "web"] = "news", 
               include_domains: Optional[List[str]] = None,
               **kwargs) -> SearchResponse:
        """
        Perform a web search using the custom endpoint.
        
        Args:
            query (str): Search query
            max_results (int): Maximum number of results to return
            search_days (int): Number of days to search back
            search_mode (Literal["news", "web"]): The type of search to perform
            include_domains (Optional[List[str]]): List of domains to include in the search
            **kwargs: Additional parameters to pass to the search endpoint
        
        Returns:
            SearchResponse: Search results in a format similar to Tavily's response
        """        
        if not query.strip():
            raise ValueError("The search query must be non-empty.")
        if search_days < 0:
            search_days = 15
        
        payload = {
            "query": query,
            "mode": search_mode,
            "max_results": max_results,
            "search_days": search_days,
            "include_domains": include_domains,
        }
        
        try:
            response = requests.post(self.endpoint, json=payload)
            response.raise_for_status()
            return SearchResponse(**response.json())
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error occurred: {e}")
            raise
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error occurred: {e}")
            raise
        except requests.exceptions.Timeout as e:
            logger.error(f"Timeout error occurred: {e}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"An error occurred: {e}")
            raise
        except ValueError as e:
            logger.error(f"Error parsing search response: {e}")
            raise

    def format_results_for_llm(self, results: List[SearchResponse]) -> str:
        """Format search results for LLM consumption.
        
        Args:
            results: List of search responses to format
            
        Returns:
            Formatted string containing all search results
        """
        formatted = []
        
        for query_result in results:
            formatted.extend([
                f"\nSearch Query: {query_result.query}\n",
                "-" * 80,
                self._format_individual_results(query_result.results)
            ])
            
        return "\n".join(formatted)
    
    def _format_individual_results(self, results: List[SearchResult]) -> str:
        """Helper method to format individual search results.
        
        Args:
            results: List of individual search results to format
            
        Returns:
            Formatted string containing the results
        """
        formatted = []
        
        for idx, result in enumerate(results, 1):
            formatted.extend([
                f"Result {idx}:",
                f"Title: {result.title}",
                f"Date: {result.date}",
                f"URL: {result.url}",
                "\nContent:",
                f"{result.content}\n",
                "-" * 40
            ])
            
        return "\n".join(formatted)

if __name__ == "__main__":
    # Test the client
    try:
        client = CustomSearchClient()
        query = "Who won the 2024 presidential election?"
        
        results = client.search(query = query, max_results=4, search_mode="news", search_days=-1)
        print(client.format_results_for_llm([results]))
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")