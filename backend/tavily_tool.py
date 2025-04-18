from tavily import TavilyClient 
import os
import logging
from dotenv import load_dotenv
load_dotenv()


logging.basicConfig(
    level = logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TavilySearch: 
    """A wrapper class for the Tavily API client that provides search functionality.

    This class provides methods to search for both news and general information
    using the Tavily API, with built-in error handling and result formatting.

    Args:
        api_key (str, optional): Tavily API key. Defaults to TAVILY_API_KEY environment variable.
        max_results (int, optional): Maximum number of results to return. Defaults to 2.
        include_domains (list[str], optional): List of domains to include in search. Defaults to empty list.

    Example:
        >>> from tavily_tool import TavilySearch
        >>> searcher = TavilySearch(max_results=3)
        >>> results = searcher.search_news("AI developments")
        >>> formatted = searcher.format_result(results)
    """
    def __init__(self, 
                 api_key: str = os.environ.get("TAVILY_API_KEY"),
                 max_results: int = 2,
                 search_days: int = 30,
                 include_domains: list[str] = None):
        "Initialize Tavily client"
        if not api_key:
            logger.error("TAVILY_API_KEY is not set in the environment variables")
            raise ValueError("TAVILY_API_KEY is required")
        self.api_key = api_key 
        try:
            self.client = TavilyClient(api_key=self.api_key)
        except Exception as e:
            logger.error(f"Error initializing Tavily client: {str(e)}")
            raise ValueError("Failed to initialize Tavily client")
        
        # Validate include_domains
        if include_domains is not None:
            if not isinstance(include_domains, list):
                logger.error("include_domains must be a list of strings")
                raise ValueError("include_domains must be a list of strings")
            if not all(isinstance(domain, str) for domain in include_domains):
                logger.error("All domains in include_domains must be strings")
                raise ValueError("All domains in include_domains must be strings")
        self.include_domains = include_domains

        # max results and search days have to be greater than 0
        if max_results <= 0:
            logger.warning("Max results must be greater than 0, setting to 2")
            self.max_results = 2
        else: 
            self.max_results = max_results
        
        if search_days <= 0:
            logger.warning("Search days must be greater than 0, setting to 30")
            self.search_days = 30
        else: 
            self.search_days = search_days
    
    def search_news(self, query: str) -> str: 
        "Conduct Tavily Search for recent news"
        if not query:
            logger.error("Query is required")
            return {"error": "Search query cannot be empty"}
        logger.info(f"Conducting news search for query: {query}")
        try:
            response = self.client.search(
                query = query,
                search_depth = "advanced",
                max_results = self.max_results,
                topic = "news",
                days = self.search_days,
                include_domains = self.include_domains
            )
            logger.info("News search completed successfully")
            return response
        except Exception as e:
            logger.error(f"Error conducting news search: {str(e)}")
            return {"error": f"Error conducting news search: {str(e)}"}
    
    def search_general(self, query: str) -> str: 
        "Conduct search for general information"
        if not query:
            logger.error("Query is required")
            return {"error": "Search query cannot be empty"}
        logger.info(f"Conducting general search for query: {query}")
        try: 
            response = self.client.search(
                query = query,
                search_depth = "advanced",
                max_results = self.max_results,
                topic = "general",
                include_domains = self.include_domains
            )
            logger.info("General search completed successfully")
            return response
        except Exception as e:
            logger.error(f"Error conducting general search: {str(e)}")
            return {"error": f"Error conducting general search: {str(e)}"}
        
    def format_result(self, response: dict) -> str: 
        """
        Format Tavily search results into an organized dictionary.
        
        Args:
            response (dict): Tavily API response dictionary
            
        Returns:
            str: Formatted dict of search results
        """
        # check if the response is a dictionary
        if not isinstance(response, dict):
            error_msg = f"Invalid response type: expected dict, got {type(response)}"
            logger.error(error_msg)
            return {"error": error_msg}
        
        try: 
            if not response.get('results'):
                logger.warning("No results found in the response")
                return {'error': 'No results found'}
            formatted_results = {
                "query": response.get("query", ""),
                "results": []
            }

            # Format each result
            for result in response.get("results", []):
                # Just use the raw date string
                date_str = result.get("published_date", "")
                
                # build the result dictionary 
                result_dict = {
                    "title": result.get("title", ""),
                    "date": date_str,
                    "url": result.get("url", ""),
                    "content": result.get("content", "No content available")
                }
                formatted_results["results"].append(result_dict)
            logger.debug("Search results formatted successfully")
            return formatted_results
        
        except Exception as e:
            logger.error(f"Error formatting search results: {str(e)}")
            return {"error": f"Error formatting search results: {str(e)}"}