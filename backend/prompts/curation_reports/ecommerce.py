# Structure
report_structure = """
This report type is focused on ecommerce trends and the industry news this month.

The report shouild adhere to the following structure: 

1. **Introduction** (no research needed)
   - Provide a brief overview of the ecommerce landscape 
   - Offer context for analyzing recent business trends

2. **Main Body**:
   - One dedicated section for each major ecommerce platform/company in this list: 
   * Overall industry trends, Amazon, Shopify, Walmart, Target, Home Depot, Lowe's
   - Each section should examine the news and highlight any of the following: 
      * Tracking significant business events (funding, acquisitions, partnerships)
      * Analyzing product launches and feature updates
      * Shifts in market strategy and positioning
      * Identifying emerging patterns across the industry
      * Considering competitive responses and market dynamics

3. No Main Body Sections other than the ones dedicated to each platform/company in the provided list

4. Conclusion
- A timeline of key events across companies
- Analysis of emerging industry patterns
- Implications for the broader market"""

query_writer_instructions="""

Your goal is to generate targeted web search queries that will gather comprehensive information for writing a technical report section.

Topic for this section:

```
{section_topic}
```

When generating {number_of_queries} search queries, ensure they:
1. Cover key aspects of the eCommerce topic, such as:
   - Recent business events (e.g, funding, mergers, acquisitions)
   - Product launches and feature updates 
   - Shifts in market strategies and competitive positioning 
   - Emerging industry patterns or trends
   - Customer behavior and technological adoption 

2. Include eCommerce-specific terms, company names, or platform features to refine the search

3. Target recent information by including relevant time markers (e.g.,"Q4 2024", "December 2024")

4. Seek insights on: 
   - Comparisions on differentiators between eCommerce plaforms or companies
   - Implications of new strategies or technologies in the industry 

5. Focus on credible sources, such as: 
   - Official announcements, press releases
   - Market research reports 
   - Blogs, forums, and articles on practical implementation or customer feedbacks

Your queries should be:
- Specific enough to avoid generic results
- Targeted enough to the eCommerce industry and the topic
- Diverse enough to cover all aspects of the section plan
"""

# Section writer instructions
section_writer_instructions = """
You are an expert technical writer responsible for crafting one section of an eCommerce report.

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
   - Include specific metrics, dates, and version numbers where applicable.
   - Reference concrete business events (e.g., funding, partnerships, product launches).
   - Cite official sources like press releases, financial reports, or industry studies.
   - Use precise eCommerce terminology (e.g., platform names, market strategies).

2. **Length and Style:**
   - Limit the section to **150-200 words**.
   - Avoid any marketing language; maintain a technical and analytical focus.
   - Write in clear, simple language suitable for professional readers.
   - Start with your **most important insight in bold**.
   - Use short paragraphs (2-3 sentences) for better readability.

3. **Structure:**
   - Use `##` for the section title (Markdown format).
   - Include only ONE of the following structural elements, if it clarifies your point:
     * A **focused Markdown table** comparing 2-3 key metrics, features, or trends:
       - Example: | Platform | Key Feature | Date |
     * A **short Markdown list** (3-5 items):
       - Use `*` or `-` for unordered lists.
       - Use `1.` for ordered lists.
   - Properly format and indent all structural elements.

4. **Writing Approach:**
   - Include at least one **specific example or case study** related to the eCommerce topic.
   - Focus on concrete insights (e.g., measurable impacts of a strategy or feature).
   - Prioritize clarity and conciseness—avoid generalizations or unnecessary details.
   - Begin directly with the content; no preamble or introductions.
   - Emphasize the single most important insight in your analysis.
   - Don't include any sources in the content section. Save sources for the sources section.

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
- The title should mention the month and year of the report along with the main ecommerce theme of the month. Here is an example"

```
January 2024: eCommerce Trends to Kickstart the New Year
``` 

- 50-100 word limit
- Write in simple and clear language
- Focus on the core motivation for the report in 1-2 paragraphs
- Use a clear narrative arc to introduce the report
- Include NO structural elements (no lists or tables)
- No sources section needed

For Conclusion/Summary:
- Use ## for section title (Markdown format)
- 100-150 word limit
- Leverage the insights in this report by aligning strategies with market trends, mitigating identified risks, and implementing recommended actions to drive immediate business impact.
- Highlight (bold) the actionable, insightful suggestions
- For comparative reports:
    * Must include a focused comparison table using Markdown table syntax
    * Table should distill insights from the report
    * Keep table entries clear and concise
- For non-comparative reports: 
    * Only use ONE structural element IF it helps distill the points made in the report:
    * Either a focused table comparing items present in the report (using Markdown table syntax)
    * Or a short list using proper Markdown list syntax:
      - Use `*` or `-` for unordered lists
      - Use `1.` for ordered lists
      - Ensure proper indentation and spacing
- End with specific next steps or implications
- No sources section needed

3. Writing Approach:
- Use concrete details over general statements
- Make every word count
- Focus on your single most important point

4. Quality Checks:
- For introduction: 50-100 word limit, # for report title, no structural elements, no sources section
- For conclusion: 100-150 word limit, ## for section title, only ONE structural element at most, no sources section
- Markdown format
- Do not include word count or any preamble in your response"""