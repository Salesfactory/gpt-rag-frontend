report_structure = """
This report type is focused on analyzing key trends, challenges, and opportunities in the home improvement sector over the past month.

The report should adhere to the following structure:

1. **Introduction** (no research needed)
   - Provide a brief overview of the home improvement industry and its current market dynamics.
   - Offer context for understanding the key trends, challenges, and opportunities analyzed in the report.

2. **Main Body**:
   - Organize sections based on the following categories:
     * **Market Trends**:
       - Overview of consumer behavior and demand for home improvement products and services.
       - Analysis of significant trends, such as DIY vs. professional services, smart home integration, or sustainability-focused renovations.
     * **Regional Highlights**:
       - Focus primarily on the US market, but also include insights from other major markets.
       - Key trends, policy changes, or regional challenges influencing home improvement markets.
     * **Challenges and Risk Analysis**:
       - Identify significant challenges impacting the industry, such as supply chain disruptions, labor shortages, or fluctuating material costs.
       - Discuss potential implications for businesses and mitigation strategies.
     * **Competitive and Industry Analysis**:
       - Highlight major competitors and their strategic moves, such as product launches or market expansions.
       - Include performance metrics, innovation, or industry-specific benchmarks shaping the competitive landscape.

3. **Conclusion**:
   - Recap of key developments and trends within the home improvement industry for the month.
   - Emerging opportunities, and strong actionable recommendations for stakeholders, company leaders, investors, and company CEOS.

"""

query_writer_instructions="""

Your goal is to generate targeted web search queries that will gather comprehensive information for writing a technical report section.

Topic for this section:

```
{section_topic}
```

When generating {number_of_queries} search queries, ensure they:
1. Cover key aspects of the home improvement topic, such as:
   - Recent trends in consumer behavior and demand for home improvement products and services.
   - Challenges impacting the sector, such as supply chain disruptions, labor shortages, or material costs.
   - Innovations and emerging opportunities, such as smart home technologies and sustainable building materials.
   - Regional highlights, including market dynamics and policy or regulatory changes affecting the industry.
   - Competitive analysis of major players and their strategies (e.g., product launches, partnerships, market expansions).

2. Include industry-specific terms, key metrics, and relevant regions or countries to refine the search.

3. Target recent information by including relevant time markers (e.g., "Q4 2024," "December 2024").

4. Seek insights on:
   - Comparisons of trends and challenges across regions or segments (e.g., DIY vs. professional services, regional material shortages).
   - The implications of market changes, regulatory developments, or emerging technologies for industry stakeholders.
   - Opportunities for innovation or growth in specific segments (e.g., smart homes, sustainable renovations).

5. Focus on credible sources, such as:
   - Reports from industry research firms, trade associations, or market analysts.
   - Company press releases, earnings reports, and investor updates.
   - Government or regulatory statements affecting home improvement markets.
   - Reputable business news outlets, blogs, or expert commentary on the home improvement sector.

Your queries should be:
- Specific enough to avoid generic results.
- Targeted to the home improvement topic and region of interest.
- Diverse enough to cover all aspects of the section plan.
"""



# Section writer instructions
section_writer_instructions = """
You are an expert technical data-driven writer responsible for crafting one section of a Monthly Home Improvement Report.

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
   - Include specific metrics, dates, and key industry indicators (e.g., market share, material costs, sales figures, or consumer behavior trends).
   - Reference concrete events (e.g., supply chain disruptions, new regulations, product launches, or major competitor moves).
   - Cite official sources such as industry reports, company updates, or trade association publications.
   - Use precise terminology related to the home improvement sector and maintain clarity.

2. **Length and Style:**
   - Limit the section to **70-120 words**.
   - Maintain an analytical and professional tone; avoid opinionated or speculative language.
   - Write in clear, concise language suitable for business leaders, analysts, and professionals in the industry.
   - Start with your **most important insight in bold**.
   - Use short paragraphs (2-3 sentences) for better readability.

3. **Structure:**
   - Use `##` for the section title (Markdown format).
   - Include only ONE of the following structural elements if relevant:
     * A **focused Markdown table** summarizing key metrics or comparisons:
       - Example: | Consumer Interest | Sales Growth (%) | Average Selling Price (%) |
     * A **short Markdown list** (3-5 items):
       - Use `*` or `-` for unordered lists.
       - Use `1.` for ordered lists.
   - Properly format and indent all structural elements.

4. **Writing Approach:**
   - Include at least one **specific example or case study** related to the home improvement topic.
   - Focus on actionable insights (e.g., implications of rising material costs, shifts in consumer demand, or innovative technologies).
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
   - Strictly adhere to the **80-120 word count** (excluding title and sources).
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
- The title should mention the month and year of the report along with the main theme of the home improvement industry. Example:

```
{report_month_year}: Key Trends in the Home Improvement Industry
```

- 80-120 word limit.
- Write in simple and clear language.
- Focus on the purpose and scope of the report in 1-2 paragraphs.
- Use a concise narrative arc to introduce the report.
- Include NO structural elements (no lists or tables).
- No sources section needed.

For Conclusion/Summary:
- Use ## for section title (Markdown format).
- 100-120 word limit.
- Leverage the insights from this report by identifying actionable strategies for businesses, manufacturers, or retailers in the home improvement sector to address challenges and capitalize on opportunities.
- Highlight (bold) key takeaways and actionable insights.

- For comparative analyses:
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

2. Writing Approach:
- Prioritize concrete details over generalizations.
- Ensure every word contributes to clarity and precision.
- Focus on the single most critical insight for each section.

3. Quality Checks:
- Use Markdown format.
- Do not include word count or any preamble in your response.
"""
