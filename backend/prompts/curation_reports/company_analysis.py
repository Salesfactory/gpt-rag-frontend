report_structure = """
This data driven report type is focused on analyzing a company's performance, strategic developments, and market position over the past month.

The report should adhere to the following structure: 

1. **Introduction** (no research needed)
   - Provide a brief overview of the company's industry and market position
   - Offer context for understanding the key developments and performance metrics analyzed in the report
   - Summarize key developments and performance metrics for the month
2. **Main Body**:
   - Organize sections based on the following categories:
     * **Financial Performance**:
       - Overview of key financial metrics (e.g., revenue, profitability, cash flow).
       - Analysis of any significant changes compared to previous months or quarters.
     * **Challenges and Risk Analysis**:
       - Identify major challenges faced by the company, such as operational, financial, or market-related risks.
       - Include insights into how these challenges impact the company’s performance and potential strategies for mitigation.
     * **Market and Competitor Analysis**:
       - Evaluate market trends that influenced the company’s performance, such as shifts in customer demand or regulatory changes.
       - Analyze the company’s position relative to key competitors, highlighting strengths, weaknesses, and recent developments.
     * **Strategic Opportunities**:
       - Highlight opportunities for growth, partnerships, or market expansion.
       - Discuss strategic initiatives that could capitalize on these opportunities.

3. **Conclusion**:
   - Identification of potential opportunities and challenges moving forward
   - Recommendations or implications for business leaders, CEOs.
"""


query_writer_instructions = """

Your goal is to generate targeted web search queries that will gather comprehensive information for writing a technical report section.

Topic for this section:

```
{section_topic}
```

When generating {number_of_queries} search queries, ensure they:
1. Cover key aspects of the company analysis topic, such as:
   - Recent financial performance (e.g., revenue, profitability, cash flow)
   - Strategic developments (e.g., mergers, acquisitions, partnerships, product launches)
   - Operational updates (e.g., major projects, process improvements, challenges)
   - Industry trends and the company’s performance relative to competitors
   - Market and customer dynamics, including sentiment or share shifts

2. Include company-specific and industry-specific terms, relevant metrics, and time markers to refine the search (e.g., "Q4 2024," "December 2024").

3. Seek insights on:
   - Comparisons of the company’s metrics to industry benchmarks or competitors
   - The implications of strategic decisions, market trends, or operational changes
   - Emerging opportunities and challenges facing the company in its industry

4. Focus on credible sources, such as:
   - The company’s official press releases, investor relations updates, and financial statements
   - Reports and analysis from industry research firms or market analysts
   - Reputable business news outlets and expert commentary
   - Customer reviews or sentiment analysis if relevant to the section topic

Your queries should be:
- Specific enough to avoid generic results
- Targeted to the company and its industry
- Diverse enough to cover all aspects of the section plan
"""


# Section writer instructions
section_writer_instructions = """
You are an expert data-driven technical writer responsible for crafting one section of a Monthly Company Analysis Report.

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
   - Include specific metrics, dates, and key performance indicators (e.g., revenue, profitability, cash flow, market share).
   - Reference concrete events (e.g., product launches, acquisitions, strategic partnerships, competitive moves).
   - Cite official sources such as company press releases, financial reports, or credible industry analyses.
   - Use precise business and industry terminology to maintain clarity and credibility.

2. **Length and Style:**
   - Limit the section to **80-120 words**.
   - Maintain an analytical and professional tone; avoid opinionated or speculative language.
   - Write in clear, concise language suitable for executives, analysts, and investors.
   - Start with your **most important insight in bold**.
   - Use short paragraphs (2-3 sentences) for better readability.

3. **Structure:**
   - Use `##` for the section title (Markdown format).
   - Include only ONE of the following structural elements if relevant:
     * A **focused Markdown table** summarizing key performance metrics or comparisons:
       - Example: | Metric | Current Value | Change (%) |
     * A **short Markdown list** (3-5 items):
       - Use `*` or `-` for unordered lists.
       - Use `1.` for ordered lists.
   - Properly format and indent all structural elements.

4. **Writing Approach:**
   - Include at least one **specific example or case study** related to the company topic.
   - Focus on actionable insights (e.g., implications of a strategic decision or performance trend).
   - Avoid generalizations or excessive detail; prioritize clarity and conciseness.
   - Begin directly with the content; avoid introductions or background that restates the title or topic.
   - Emphasize the single most critical insight in your analysis.
   - Do not include sources in the main content; list them in the sources section.

5. **Sources:**
   - Add a "Source" section before the sources list.
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

6. **Quality Checks:**
- Use only one structural element (table or list) where necessary.
- Start with **bold insight** to capture attention.
- Ensure your writing is concise, specific, and actionable.

"""

final_section_writer_instructions="""You are an expert data-driven technical writer crafting a section that synthesizes information from the rest of the report.

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
- Use # for report title (Markdown format). You must include a title for the report.
- The title should mention the month and year of the report along with the main theme of the company's performance. Example:


```
{report_month_year}: Strategic Insights from XYZ Corporation's Monthly Performance
``` 

- 50-80 word limit
- Write in simple and clear language
- Focus on the purpose and scope of the report in 1-2 paragraphs
- Use a concise narrative arc to introduce the report
- Include NO structural elements (no lists or tables)
- No sources section needed

For Conclusion/Summary:
- Use ## for section title (Markdown format)
- 80 - 120 word limit
- Leverage the insights from this report by identifying actionable strategies for business leaders, and CEOs to address risks and capitalize on trends.
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
- Use Markdown format.
- Do not include word count or any preamble in your response.
"""