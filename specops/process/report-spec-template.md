# Report Spec: {REPORT NAME}

**Module:** {MODULE CODE}
**Report Type:** Tabular / Financial Statement / Chart / Summary
**Template:** T8 Report Template
**Priority:** Core / Secondary / Deferred

---

## 1. Description

{What this report shows and who uses it.}

---

## 2. Parameters (Filter Panel)

| Parameter | Type                                     | Required | Default | Options/Source |
| --------- | ---------------------------------------- | -------- | ------- | -------------- |
|           | date / dropdown / lookup / toggle / text |          |         |                |

---

## 3. Output Columns

| Column | Field/Calculation | Format                                       | Sortable | Groupable |
| ------ | ----------------- | -------------------------------------------- | -------- | --------- |
|        |                   | text / number / currency / date / percentage |          |           |

---

## 4. Grouping & Subtotals

- **Group by:** {e.g., account type, customer, period}
- **Subtotals at:** {each group break}
- **Grand total:** {yes/no, which columns}

---

## 5. Sort Order

Default: {e.g., account code ascending}
User can sort by: {list sortable columns}

---

## 6. Data Source

**Query:** {describe the query logic — which tables, joins, filters, aggregations}

**Performance notes:** {e.g., "uses pre-calculated aging table", "may be slow for >10k records — consider background generation"}

---

## 7. Export Formats

- [ ] PDF
- [ ] Excel (CSV)
- [ ] Print

---

## 8. Special Rendering (if applicable)

{For financial statements: hierarchical account grouping, indentation, bold totals.}
{For charts: chart type, axes, legend.}
