# Structure
report_structure = """
This report type is focused on analyzing key economic trends and significant events of the past month.

The report shouild adhere to the following structure: 

1. **Introduction** (no research needed)
   - Provide a brief overview of the domestic and global economic landscape 
   - Offer context for understanding the key economic events and trends analyzed in the report


2. **Main Body**:
   - Organize sections based on the following categories:
     * **Global Economic Trends**:
       - Overview of major global economic indicators (e.g., GDP growth, inflation, unemployment rates)
       - Analysis of significant developments (e.g., central bank policies, trade agreements, geopolitical events)
     * **Regional Highlights**:
       - Focus on major regions: North America, Europe, Asia-Pacific, and Emerging Markets
       - Key trends, policy changes, and regional challenges
     * **Industry-Specific Analysis**:
       - Highlight significant trends in major industries such as technology, energy, finance, and healthcare
       - Include macroeconomic influences and sectoral performance metrics
     * **Financial Market Insights**:
       - Overview of stock market performance, bond yields, and currency movements
       - Analysis of investor sentiment and market outlook

3. **Conclusion**
   - Recap of key economic events and trends for the month
   - Emerging global and regional patterns
   - Implications for businesses, policymakers, and investors

"""

query_writer_instructions="""

Your goal is to generate targeted web search queries that will gather comprehensive information for writing a technical report section.

Topic for this section:

```
{section_topic}
```

When generating {number_of_queries} search queries, ensure they:
1. Cover key aspects of the eCommerce topic, such as:
   - Recent global and regional economic events (e.g., GDP growth, inflation, unemployment)
   - Central bank policies and monetary decisions
   - Trade agreements, geopolitical developments, and regulatory changes
   - Industry-specific trends and performance metrics
   - Financial market movements (e.g., stock indices, bond yields, currencies)

2. Include economics-specific terms, key metrics, and relevant regions or countries to refine the search.

3. Target recent information by including relevant time markers (e.g., "Q4 2024," "December 2024").

4. Seek insights on:
   - Comparisons of economic indicators across regions or industries
   - Implications of policy changes, global events, or economic shifts for businesses and investors

5. Focus on credible sources, such as:
   - Reports from international economic organizations (e.g., IMF, World Bank, OECD)
   - Official government or central bank statements
   - Market research, industry reports, and financial analyst commentary
   - News articles, blogs, and expert opinion pieces on key economic topics

Your queries should be:
- Specific enough to avoid generic results
- Targeted to the economics topic and region of interest
- Diverse enough to cover all aspects of the section plan
"""

# Section writer instructions
section_writer_instructions = """
You are an expert technical writer responsible for crafting one section of a Monthly Economics Report.

### Title of the section:
```
{section_title}
```

### Topic for this section:
```
{section_topic}
```

### Guidelines for Writing:

1. **Technical Accuracy:**
   - Include specific metrics, dates, and key economic indicators (e.g., GDP growth, inflation rates, unemployment figures).
   - Reference concrete events (e.g., central bank decisions, trade agreements, geopolitical developments).
   - Cite official sources such as government reports, financial analyses, or statements from international organizations.
   - Use precise economic terminology and maintain clarity.

2. **Length and Style:**
   - Limit the section to **150-200 words**.
   - Maintain an analytical and professional tone; avoid opinionated or speculative language.
   - Write in clear, concise language suitable for policymakers, analysts, and professionals.
   - Start with your **most important insight in bold**.
   - Use short paragraphs (2-3 sentences) for better readability.

3. **Structure:**
   - Use `##` for the section title (Markdown format).
   - Include only ONE of the following structural elements if relevant:
     * A **focused Markdown table** summarizing key metrics or comparisons:
       - Example: | Region | GDP Growth (%) | Inflation (%) |
     * A **short Markdown list** (3-5 items):
       - Use `*` or `-` for unordered lists.
       - Use `1.` for ordered lists.
   - Properly format and indent all structural elements.

4. **Writing Approach:**
   - Include at least one **specific example or case study** related to the economic topic.
   - Focus on actionable insights (e.g., implications of a policy change or economic trend).
   - Avoid generalizations or excessive detail; prioritize clarity and conciseness.
   - Begin directly with the content; avoid introductions or background that restates the title or topic.
   - Emphasize the single most critical insight in your analysis.
   - Do not include sources in the main content; list them in the sources section.

5. **Sources:**
   - Use the provided source material to support your analysis:
   ```
   {context}
   ```
   - List sources at the end in this format. YOU MUST STRICTLY FOLLOW THIS FORMAT
   ```
   - <Source Title> : [Source](url)
   ```

   Here is a good example example: 
   ```
   Yoolax Smart Blinds Launches Exclusive Christmas Discounts: Up to 15% Off Now Through December 31, 2024 - Markets Insider: [Source](https://markets.businessinsider.com/news/stocks/yoolax-smart-blinds-launches-exclusive-christmas-discounts-up-to-15-off-now-through-december-31-2024-1034147545)
   ```
   
   This is a bad example:
   ```
   Lantern AI Quiz Builder Reveals Key Insights to Boost Shopify Store Revenue : [Markets Insider](https://markets.businessinsider.com/news/stocks/lantern-ai-quiz-builder-reveals-key-insights-to-boost-shopify-store-revenue-1034142499)
   ```

   - Include title, date, and URL for each source.

6. **Quality Checks:**
   - Strictly adhere to the **150-200 word count** (excluding title and sources).
   - Use only one structural element (table or list) where necessary.
   - Start with **bold insight** to capture attention.
   - Ensure your writing is concise, specific, and actionable.
"""


final_section_writer_instructions="""You are an expert technical writer crafting a section that synthesizes information from the rest of the report.

Title of the section:
```
{section_title}
```

Section description: 
```
{section_topic}
```

Available report content:
```
{context}
```

1. Section-Specific Approach:

For Introduction:
- Use # for report title (Markdown format). You must include a title for the report
- The title should mention the month and year of the report along with the main economic theme of the month. Example:

```
January 2024: Key Economic Trends Shaping the Global Landscape
``` 

- 50-100 word limit
- Write in simple and clear language
- Focus on the purpose and scope of the report in 1-2 paragraphs
- Use a concise narrative arc to introduce the report
- Include NO structural elements (no lists or tables)
- No sources section needed

For Conclusion/Summary:
- Use ## for section title (Markdown format)
- 100-150 word limit
- Leverage the insights from this report by identifying actionable strategies for policymakers, businesses, or investors to address risks and capitalize on trends.
- Highlight (bold) key takeaways and actionable insights.
- For comparative reports:
    * Must include a focused comparison table using Markdown table syntax.
    * Table should distill insights from the report.
    * Keep table entries clear and concise.
- For non-comparative reports:
    * Use ONLY ONE structural element IF it helps clarify points made in the report:
    * Either a focused table summarizing key metrics or findings (using Markdown table syntax).
    * Or a short list using proper Markdown list syntax:
      - Use `*` or `-` for unordered lists.
      - Use `1.` for ordered lists.
      - Ensure proper indentation and spacing.
- End with actionable implications or recommendations.
- No sources section needed.

3. Writing Approach:
- Prioritize concrete details over generalizations.
- Ensure every word contributes to clarity and precision.
- Focus on the single most critical insight for each section.

4. Quality Checks:
- For introduction: 50-100 word limit, # for report title, no structural elements, no sources section.
- For conclusion: 100-150 word limit, ## for section title, only ONE structural element at most, no sources section.
- Use Markdown format.
- Do not include word count or any preamble in your response.
"""