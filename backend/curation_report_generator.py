# library 
import os
from dotenv import load_dotenv
import requests
import markdown2
import json
import operator
from datetime import datetime
from typing import Annotated, List, Optional, Literal
from typing_extensions import TypedDict
from pydantic import BaseModel, Field
from pathlib import Path
from IPython.display import Image, display, Markdown

from langgraph.constants import Send
from langgraph.graph import START, END, StateGraph
from langchain_core.messages import HumanMessage, SystemMessage
from datetime import datetime
from financial_doc_processor import BlobStorageManager
from importlib import import_module
from llm_config import LLMManager, LLMConfig
from financial_agent_utils.curation_report_config import WEEKLY_CURATION_REPORT

from prompts.curation_reports.general import (
    report_planner_query_writer_instructions,
    report_planner_instructions
)

from financial_agent_utils.curation_report_tools.web_search import CustomSearchClient

load_dotenv()

import logging 


logging.basicConfig(
    level = logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

####################################
# LLM and Tools
####################################

llm_manager = LLMManager()
llm_writing = llm_manager.get_client(client_type='gpt4o', use_langchain=True)

web_search_tool = CustomSearchClient()
# query (str): Search query
# max_results (int): Maximum number of results to return
# search_mode (str): Search topic (e.g., "news")
# search_days (int): Number of days to search for news
# **kwargs: Additional parameters to pass to the search endpoint (e.g., include_domains)

MAX_RESULTS = 3 # for web search query results
REPORT_TYPES = Literal["Ecommerce", "Monthly_Economics", "Weekly_Economics"]

# get the right system prompt for the report

class ReportPrompts:
    def __init__(self, report_type: str):
        try:
            # Dynamically import the prompt module based on report type
            module_name = report_type.lower()
            prompt_module = import_module(f"prompts.curation_reports.{module_name}")
            
            # Get all prompts from the module
            self.report_structure = getattr(prompt_module, 'report_structure')
            self.final_section_writer_instructions = getattr(prompt_module, 'final_section_writer_instructions')
            self.query_writer_instructions = getattr(prompt_module, 'query_writer_instructions')
            self.section_writer_instructions = getattr(prompt_module, 'section_writer_instructions')
        except (ImportError, AttributeError) as e:
            logger.error(f"Failed to load prompts for report type {report_type}: {str(e)}")
            raise ValueError(f"Invalid report type or missing prompts: {report_type}")

####################################
# State Definitions
####################################

class Section(BaseModel):
    name: str = Field(
        description="Name for this section of the report.",
    )
    description: str = Field(
        description="Brief overview of the main topics and concepts to be covered in this section.",
    )
    research: bool = Field(
        description="Whether to perform web research for this section of the report."
    )
    content: str = Field(
        description="The content of the section."
    )   

class Sections(BaseModel):
    sections: List[Section] = Field(
        description="Sections of the report.",
    )

class SearchQuery(BaseModel):
    search_query: str = Field(None, description="Query for web search.")

class Queries(BaseModel):
    queries: List[SearchQuery] = Field(
        description="List of search queries.",
    )

class ReportState(TypedDict):
    topic: str # Report topic
    search_mode: Literal["general", "news"] # Search topic type
    report_type: REPORT_TYPES # Report type
    number_of_queries: int # Number web search queries to perform per section    
    sections: list[Section] # List of report sections 
    completed_sections: Annotated[list, operator.add] # Send() API key
    search_days: Optional[int] # Only applicable for news topic
    report_sections_from_research: str # String of any completed sections from research to write final sections
    final_report: str # Final report

class ReportStateOutput(TypedDict):
    final_report: str # Final report

class SectionState(TypedDict):
    search_mode: Literal["general", "news"] # Search topic type
    report_type: REPORT_TYPES # Report type
    search_days: Optional[int] # Only applicable for news topic
    number_of_queries: int # Number web search queries to perform per section 
    section: Section # Report section   
    search_queries: list[SearchQuery] # List of search queries
    source_str: str # String of formatted source content from web search
    report_sections_from_research: str # String of any completed sections from research to write final sections
    completed_sections: list[Section] # Final key we duplicate in outer state for Send() API

class SectionOutputState(TypedDict):
    completed_sections: list[Section] # Final key we duplicate in outer state for Send() API


####################################
# Research Planning
####################################

def generate_report_plan(state: ReportState):
    logger.info(f"Starting report plan generation for topic: {state['topic']}")
    
    # Inputs
    topic = state["topic"]
    report_type = state["report_type"]
    number_of_queries = state["number_of_queries"]
    search_mode = state["search_mode"]
    search_days = state["search_days"]

    # get the right system prompt for the report
    report_prompts = ReportPrompts(report_type)
    report_structure = report_prompts.report_structure

    # Generate search query
    structured_llm = llm_writing.with_structured_output(Queries)

    # Format system instructions
    system_instructions_query = report_planner_query_writer_instructions.format(topic=topic, 
                                                                                report_organization=report_structure, 
                                                                                number_of_queries=number_of_queries,
                                                                                today_date = datetime.now().strftime("%B %Y"))

    # Generate queries  
    results = structured_llm.invoke([SystemMessage(content=system_instructions_query)]+[HumanMessage(content="Generate search queries that will help with planning the sections of the report.")])
    logger.info(f"Generated {len(results.queries)} search queries to conduct web search")

    # Web search
    query_list = [query.search_query for query in results.queries]
    
    ##################################################
    # At this point, we have successfully generated a 
    # list of search queries ready for web search execution.
    ##################################################
    
    search_tasks = []
    logger.info(f"Conducting web search to design sections")
    for query in query_list:
        try:
            result = web_search_tool.search(query=query, 
                                          search_mode=search_mode, 
                                          max_results=MAX_RESULTS,
                                          search_days=search_days)
            search_tasks.append(result)
        except Exception as e:
            logger.warning(f"Search failed for query '{query}': {str(e)}")
            # Add empty/default search result
            search_tasks.append({
                "query": query,
                "results": []
            })

    # Only proceed with formatting if we have any results
    if search_tasks:
        search_tasks_str = web_search_tool.format_results_for_llm(results=search_tasks)
    else:
        search_tasks_str = "No search results found. Proceeding with report generation based on general knowledge."

    ##################################################
    # At this point, we have successfully conducted X web searches (max_results) on X queries (number of queries).
    ##################################################

    # Format system instructions
    system_instructions_sections = report_planner_instructions.format(topic=topic, 
                                                                      report_organization=report_structure, 
                                                                      context=search_tasks_str)

    # Generate sections 
    structured_llm = llm_writing.with_structured_output(Sections)

    logger.info(f"Generating section plan for the report")
    report_sections = structured_llm.invoke([SystemMessage(content=system_instructions_sections)]+[HumanMessage(content="Generate the sections of the report. Your response must include a 'sections' field containing a list of sections. Each section must have: name, description, plan, research, and content fields.")])

    ##################################################
    # Now, we have parsed web search results and topic subject matter to sections (intro, subject 1-2 in body, conclusion).
    ##################################################

    logger.info(f"Generated a report plan with {len(report_sections.sections)} sections")
    return {"sections": report_sections.sections}

####################################
# Section writing
####################################

def generate_queries(state: SectionState):    
    """ Generate search queries for a section """

    # Get state 
    number_of_queries = state["number_of_queries"]
    section = state["section"]
    report_type = state["report_type"]

    # Generate queries 
    structured_llm = llm_writing.with_structured_output(Queries)

    # Format system instructions
    report_prompts = ReportPrompts(report_type)
    system_instructions = report_prompts.query_writer_instructions.format(section_topic=section.description, number_of_queries=number_of_queries)

    # Generate queries  
    logger.info(f"Generating {number_of_queries} search queries for section {section.name}")
    queries = structured_llm.invoke([SystemMessage(content=system_instructions)]+[HumanMessage(content="Generate search queries on the provided topic.")])

    ##################################################
    # At this point, we have successfully generated <number_of_queries> queries ready for web search execution.
    ##################################################

    logger.info(f"Search queries generated for section: {state['section'].name}")
    return {"search_queries": queries.queries}

def search_web(state: SectionState):
    logger.info(f"Starting web search for section: {state['section'].name}")
    
    """ Search the web for each query, then return a list of raw sources and a formatted string of sources."""
    
    # Get state 
    search_queries = state["search_queries"]
    search_mode = state["search_mode"]
    search_days = state["search_days"]

    # Web search
    query_list = [query.search_query for query in search_queries]

    search_tasks = []
    
    ##################################################
    # Here, for each search query, we conduct X web searches (max_results) and return X sources.
    ##################################################


    for query in query_list:
        search_tasks.append(web_search_tool.search(query=query, 
                                                   search_mode = search_mode, 
                                                   max_results= MAX_RESULTS,
                                                   search_days= search_days))
        logger.info(f"Returning {MAX_RESULTS} sources for query: {query}")
    
    # convert search_tasks to a string
    search_tasks_str = web_search_tool.format_results_for_llm(results=search_tasks)
    
    ##################################################
    # total searches conducted = number of search queries * max_results
    # all converted to a string before saved to state
    ##################################################

    logger.info(f"Completed web search for section {state['section'].name}")
    return {"source_str": search_tasks_str}

def write_section(state: SectionState):
    logger.info(f"Writing content for section: {state['section'].name}")
    
    """ Write a section of the report """

    # Get state 
    section = state["section"]
    source_str = state["source_str"]
    report_type = state["report_type"]

    # Format system instructions
    report_prompts = ReportPrompts(report_type)
    system_instructions = report_prompts.section_writer_instructions.format(section_title=section.name, 
                                                             section_topic=section.description, 
                                                             context=source_str)

    # Generate section  
    logger.info(f"Generating section content for section {state['section'].name}")
    section_content = llm_writing.invoke([SystemMessage(content=system_instructions)]+[HumanMessage(content="Generate a report section based on the provided sources.")])
    
    ##################################################
    # Here, we have successfully generated a section of the report.
    ##################################################
    
    
    ##################################################
    # IMPORTANT: here, it is saving section content directly to state['section'] object
    ##################################################
    logger.info(f"Saving section content to: {section.name} section object")
    section.content = section_content.content

    ##################################################
    # content was empty when report plan was generated, now it is added 
    # research-required sections have content generated and added to completed_sections state 
    ##################################################

    # Write the updated section to completed sections
    logger.info(f"Completed writing content for section: {state['section'].name}")
    return {"completed_sections": [section]}

# Add nodes and edges 
section_builder = StateGraph(SectionState, output=SectionOutputState)
section_builder.add_node("generate_queries", generate_queries)
section_builder.add_node("search_web", search_web)
section_builder.add_node("write_section", write_section)

section_builder.add_edge(START, "generate_queries")
section_builder.add_edge("generate_queries", "search_web")
section_builder.add_edge("search_web", "write_section")
section_builder.add_edge("write_section", END)

# Compile
logger.info(f"Compiling section builder graph")
section_builder_graph = section_builder.compile()

# View
# display(Image(section_builder_graph.get_graph(xray=1).draw_mermaid_png()))

####################################
# End to end report generation
####################################


def initiate_section_writing(state: ReportState):
    """ This is the "map" step when we kick off web research for some sections of the report """    
    
    # Kick off section writing in parallel via Send() API for any sections that require research
    logger.info(f"Kicking off section writing for {len(state['sections'])} research-required sections")
    return [
        Send("build_section_with_web_research", {"section": s, 
                                                 "number_of_queries": state["number_of_queries"], 
                                                 "search_mode": state["search_mode"], 
                                                 "search_days": state["search_days"], 
                                                 "report_type": state["report_type"]}) 
        for s in state["sections"] 
        if s.research
    ]

def write_final_sections(state: SectionState):
    """ Write final sections of the report, which do not require web search and use the completed sections as context """
    
    logger.info(f"Writing final/non-research section: {state['section'].name}")

    # Get state 
    section = state["section"]
    completed_report_sections = state["report_sections_from_research"]
    report_type = state["report_type"]

    # Format system instructions
    report_prompts = ReportPrompts(report_type)

    current_date = datetime.now()
    week_of_month = (current_date.day - 1) // 7 + 1
    year = current_date.year
    current_week_and_month_and_year = f"Current week: {week_of_month}, Current month: {current_date.strftime('%B')}, Current year: {year}"

    if report_type in WEEKLY_CURATION_REPORT:
        system_instructions = report_prompts.final_section_writer_instructions.format(section_title=section.name, 
                                                                                      section_topic=section.description, 
                                                                                      context=completed_report_sections, 
                                                                                      current_week_and_month=current_week_and_month_and_year)
    ##################################################
    # Here we need to include include week so that it can write proper report title
    ##################################################
    else:
        system_instructions = report_prompts.final_section_writer_instructions.format(section_title=section.name,
                                                                                    section_topic=section.description, 
                                                                                    context=completed_report_sections)

    # Generate section  
    logger.info(f"Generating final section content for section {state['section'].name}")
    section_content = llm_writing.invoke([SystemMessage(content=system_instructions)]+[HumanMessage(content="Generate a report section based on the provided sources.")])
    
    # Write content to section 
    logger.info(f"Saving final section content to: {section.name} section object")
    section.content = section_content.content

    ##################################################
    # here, we have generated content for non-research sections
    # content is added to completed_sections state to generate final report
    ##################################################

    logger.info(f"Completed writing final section: {state['section'].name}")
    return {"completed_sections": [section]}

def format_sections(sections: list[Section]) -> str:
    """ Format a list of sections into a string """
    formatted_str = ""
    for idx, section in enumerate(sections, 1):
        formatted_str += f"""
        {'='*60}
        Section {idx}: {section.name}
        {'='*60}
        Description:
        {section.description}
        Requires Research: 
        {section.research}

        Content:
        {section.content if section.content else '[Not yet written]'}

        """
    return formatted_str

def gather_completed_sections(state: ReportState):
    """ Gather completed sections from research """    

    # List of completed sections
    completed_sections = state["completed_sections"]

    # Format completed section to str to use as context for final sections
    logger.info(f"Combining completed sections to one single string")
    completed_report_sections = format_sections(completed_sections)

    return {"report_sections_from_research": completed_report_sections}

def initiate_final_section_writing(state: ReportState):
    """ This is the "map" step when we kick off research on any sections that require it using the Send API """    

    # Kick off section writing in parallel via Send() API for any sections that do not require research (intro and conclusion)
    logger.info(f"Kicking off final section writing for non-research sections")
    return [
        Send("write_final_sections", {"section": s, 
                                      "report_sections_from_research": state["report_sections_from_research"], 
                                      "report_type": state["report_type"]}) 
        for s in state["sections"] 
        if not s.research
    ]

def compile_final_report(state: ReportState):
    logger.info("Starting final report compilation")
    
    """ Compile the final report """    

    # Get sections
    sections = state["sections"]
    completed_sections = {s.name: s.content for s in state["completed_sections"]}

    # Update sections with completed content while maintaining original order
    # actually, this is not necessary, since we have already added content to section in previous steps
    for section in sections:
        section.content = completed_sections[section.name]

    # Compile final report
    logger.info(f"Compiling final report with {len(sections)} sections")
    all_sections = "\n\n".join([s.content for s in sections])

    logger.info("Completed final report compilation")
    return {"final_report": all_sections}

# Add nodes 
builder = StateGraph(ReportState, output=ReportStateOutput)
builder.add_node("generate_report_plan", generate_report_plan)
builder.add_node("build_section_with_web_research", section_builder.compile())
builder.add_node("gather_completed_sections", gather_completed_sections)
builder.add_node("write_final_sections", write_final_sections)
builder.add_node("compile_final_report", compile_final_report)

# Add edges 
builder.add_edge(START, "generate_report_plan")
builder.add_conditional_edges("generate_report_plan", initiate_section_writing, ["build_section_with_web_research"])
builder.add_edge("build_section_with_web_research", "gather_completed_sections")
builder.add_conditional_edges("gather_completed_sections", initiate_final_section_writing, ["write_final_sections"])
builder.add_edge("write_final_sections", "compile_final_report")
builder.add_edge("compile_final_report", END)

# Compile
logger.info(f"Compiling report builder graph")
graph = builder.compile()
# display(Image(graph.get_graph(xray=1).draw_mermaid_png()))
