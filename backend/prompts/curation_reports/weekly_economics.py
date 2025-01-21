# Structure
report_structure = """
This data driven report type is focused on analyzing key economic trends and significant events of the past week.

The report should adhere to the following structure:

1. **Introduction** (no research needed)
   - Provide a brief overview of the domestic and global economic landscape for the week.
   - Offer context for understanding the key economic events and trends analyzed in the report.

2. **Main Body**:
   - Organize sections based on the following categories:
     * **Global Economic Trends**:
       - Overview of major global economic indicators for the week (e.g., GDP updates, inflation snapshots, unemployment figures).
       - Analysis of significant developments (e.g., central bank announcements, trade disputes, geopolitical updates).
     * **Regional Highlights**:
       - Focus on major regions: North America, Europe, Asia-Pacific, and Emerging Markets.
       - Key events, policy changes, and notable economic challenges.
     * **Industry-Specific Updates**:
       - Highlight weekly developments in key industries such as technology, energy, finance, and healthcare.
       - Brief analysis of macroeconomic influences on sectoral performance.
     * **Financial Market Movements**:
       - Weekly performance of stock markets, bond yields, and currency movements.
       - Analysis of investor sentiment and short-term market trends.

3. **Conclusion**
   - Recap of key economic events and trends for the week.
   - Emerging global and regional patterns.
   - Implications for businesses, policymakers, and investors over the near term.
"""

query_writer_instructions="""

Your goal is to generate targeted web search queries that will gather comprehensive information for writing a technical report section.

Topic for this section:

```
{section_topic}
```

When generating {number_of_queries} search queries, ensure they:
1. Cover key aspects of the weekly economic topic, such as:
   - Major global and regional economic events of the week (e.g., GDP updates, inflation reports, unemployment rates)
   - Central bank statements or decisions announced during the week
   - Significant trade agreements, geopolitical developments, or regulatory changes
   - Weekly trends in specific industries and performance metrics
   - Financial market movements (e.g., weekly stock index changes, bond yields, currency fluctuations)

2. Include economics-specific terms, key metrics, and relevant regions or countries to refine the search.

3. Target recent information by including weekly time markers (e.g., "week of December 18, 2024," "last week December 2024").

4. Seek insights on:
   - Week-to-week comparisons of economic indicators across regions or industries
   - Immediate implications of new policies, global events, or economic shifts for businesses, policymakers, and investors

5. Focus on credible sources, such as:
   - Reports and updates from international economic organizations (e.g., IMF, World Bank, OECD)
   - Central bank announcements and government statements
   - Market research, weekly financial analyses, and expert commentary
   - News articles or blogs providing real-time insights on economic events

Your queries should be:
- Specific enough to avoid generic results
- Focused on recent events relevant to the week in review
- Diverse enough to cover all aspects of the section plan
"""

# Section writer instructions
section_writer_instructions = """
You are an expert technical writer responsible for crafting one section of a Weekly Economics Report.

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
   - Include specific metrics, dates, and key economic indicators relevant to the week (e.g., GDP updates, weekly inflation rates, unemployment figures).
   - Reference concrete events (e.g., central bank announcements, trade negotiations, geopolitical updates).
   - Cite official sources such as government releases, financial analyses, or reports from international organizations.
   - Use precise economic terminology while maintaining clarity.

2. **Length and Style:**
   - Limit the section to **150-200 words**.
   - Maintain an analytical and professional tone; avoid subjective or speculative language.
   - Write in clear, concise language suitable for policymakers, investors, and professionals.
   - Start with your **most important insight in bold**.
   - Use short paragraphs (2-3 sentences) for better readability.

3. **Structure:**
   - Use `##` for the section title (Markdown format).
   - Include only ONE of the following structural elements if relevant:
     * A **focused Markdown table** summarizing key weekly metrics or comparisons:
       - Example: | Indicator | Value | Date |
     * A **short Markdown list** (3-5 items):
       - Use `*` or `-` for unordered lists.
       - Use `1.` for ordered lists.
   - Properly format and indent all structural elements.

4. **Writing Approach:**
   - Include at least one **specific example or case study** relevant to the economic topic of the week.
   - Focus on actionable insights (e.g., immediate implications of a policy change or trend).
   - Avoid generalizations or excessive background information; prioritize clarity and conciseness.
   - Begin directly with the content; avoid introductions or redundant restatements of the title or topic.
   - Highlight the single most important takeaway in your analysis.
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

final_section_writer_instructions="""
You are an expert technical writer crafting a section that synthesizes information from the rest of the report.

Current week and month:
```
{current_week_and_month}
```

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
- The title should mention the week and month of the report along with the main economic theme of the week. Example:

```
Week 1 of January 2024: Key Economic Trends Shaping the Global Landscape
``` 

- 50-100 word limit
- Write in simple and clear language
- Focus on the purpose and scope of the report in 1-2 paragraphs
- Use a concise narrative arc to introduce the report
- Include NO structural elements (no lists or tables)
- No sources section needed

For Conclusion/Summary:
- Use ## for section title (Markdown format).
- 100-150 word limit.
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